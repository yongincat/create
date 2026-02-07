type GenerateRequest = {
  token: string;
  inputs: {
    catName: string;
    ageValue: string;
    ageUnit: "months" | "years";
    sex: "male" | "female" | "unknown";
    neutered: "yes" | "no" | "unknown";
    temperament: string;
    rescueStory: string;
    healthNotes: string;
    specialNeeds?: string;
    contact?: string;
  };
  stylePreset: string;
  creativity: number;
};

type RateKey = {
  key: string;
  timestamps: number[];
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

const tokenBuckets = new Map<string, RateKey>();
const ipBuckets = new Map<string, RateKey>();

function jsonResponse(body: Record<string, unknown>, status = 200, origin?: string) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {})
    },
    body: JSON.stringify(body)
  };
}

function normalizeTokens(raw: string) {
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function isAllowedToken(token: string) {
  const allowed = normalizeTokens(process.env.ALLOWED_TOKENS || "");
  return allowed.includes(token);
}

function withinRateLimit(map: Map<string, RateKey>, key: string) {
  const now = Date.now();
  const entry = map.get(key) || { key, timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
  entry.timestamps.push(now);
  map.set(key, entry);
  return entry.timestamps.length <= MAX_REQUESTS_PER_WINDOW;
}

function mapCreativity(value: number) {
  const clamped = Math.max(0, Math.min(100, value));
  const temp = 0.2 + (0.7 * clamped) / 100;
  return Number(temp.toFixed(2));
}

function buildPrompt(payload: GenerateRequest) {
  const { inputs, stylePreset } = payload;
  const temperament = inputs.temperament?.trim() || "Not specified";

  return (
    `Style preset: ${stylePreset}\n\n` +
    `Cat name: ${inputs.catName || "Not specified"}\n` +
    `Age: ${inputs.ageValue || "Not specified"} ${inputs.ageUnit}\n` +
    `Sex: ${inputs.sex}\n` +
    `Neutered/Spayed: ${inputs.neutered}\n` +
    `Temperament: ${temperament}\n` +
    `Rescue story: ${inputs.rescueStory || "Not specified"}\n` +
    `Health notes: ${inputs.healthNotes || "Not specified"}\n` +
    `Special needs: ${inputs.specialNeeds || "None"}\n` +
    `Contact: ${inputs.contact || "Not specified"}`
  );
}

function getAllowedOrigin(requestOrigin?: string | null) {
  const allowed = process.env.ALLOWED_ORIGIN || "";
  if (!requestOrigin || !allowed) return "";
  return requestOrigin === allowed ? requestOrigin : "";
}

export const handler = async (event: any) => {
  const origin = getAllowedOrigin(event.headers?.origin || event.headers?.Origin);

  if (event.httpMethod === "OPTIONS") {
    if (!origin) {
      return { statusCode: 403, body: "" };
    }
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400"
      },
      body: ""
    };
  }

  if (!origin) {
    return jsonResponse({ error: "허용되지 않은 출처입니다." }, 403);
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse({ error: "허용되지 않은 요청 방식입니다." }, 405, origin);
  }

  let payload: GenerateRequest;
  try {
    payload = JSON.parse(event.body || "{}") as GenerateRequest;
  } catch {
    return jsonResponse({ error: "요청 형식이 올바르지 않습니다." }, 400, origin);
  }

  if (!payload?.token || !isAllowedToken(payload.token)) {
    return jsonResponse({ error: "접근 권한이 없습니다." }, 401, origin);
  }

  const ip =
    event.headers?.["x-nf-client-connection-ip"] ||
    event.headers?.["x-forwarded-for"] ||
    "unknown";
  const tokenOk = withinRateLimit(tokenBuckets, payload.token);
  const ipOk = withinRateLimit(ipBuckets, ip);
  if (!tokenOk || !ipOk) {
    return jsonResponse({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }, 429, origin);
  }

  const maxOutputChars = Number(process.env.MAX_OUTPUT_CHARS || 2500);
  const temperature = mapCreativity(payload.creativity || 0);

  const system =
    `You create cat adoption promotion posts.\n` +
    `Follow this exact structure:\n` +
    `1) Title line.\n` +
    `2) 3-6 short paragraphs.\n` +
    `3) Facts bullet list with age, sex, neutered/spayed, and health.\n` +
    `4) Clear call-to-action ending.\n` +
    `Keep tone consistent with the style preset.\n` +
    `Avoid medical guarantees and do not invent personal data.\n` +
    `Only use the contact info provided.\n` +
    `Output format must be:\n` +
    `Title: <single line title>\n` +
    `Body:\n` +
    `<3-6 short paragraphs>\n` +
    `- Facts bullet list (age/sex/neutered/health)\n` +
    `Call-to-action ending line.`;

  const prompt = buildPrompt(payload);
  const promptId = process.env.PROMPT_ID || "";

  const openaiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature,
      top_p: Math.min(1, 0.9 + temperature * 0.1),
      max_output_tokens: 700,
      ...(promptId ? { metadata: { prompt_id: promptId } } : {}),
      input: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!openaiRes.ok) {
    const text = await openaiRes.text();
    return jsonResponse({ error: `OpenAI 오류: ${text}` }, 502, origin);
  }

  const data = (await openaiRes.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  const rawText =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text || "")
      .join("\n") ||
    "";
  const trimmed = rawText.slice(0, maxOutputChars);
  const parsed = parseTitleAndBody(trimmed);

  return jsonResponse({ title: parsed.title, text: parsed.text }, 200, origin);
};

function parseTitleAndBody(text: string) {
  const fallbackLines = text.split("\n").filter((line) => line.trim() !== "");
  const fallbackTitle = fallbackLines.length ? fallbackLines[0].trim() : "";

  const titleMatch = text.match(/Title:\\s*(.+)/i);
  const bodyMatch = text.match(/Body:\\s*([\\s\\S]*)/i);

  if (titleMatch && bodyMatch) {
    const title = titleMatch[1].trim();
    const body = bodyMatch[1].trim();
    return { title, text: body };
  }

  const bodyFallback = fallbackLines.length > 1
    ? fallbackLines.slice(1).join(\"\\n\").trim()
    : text;

  return { title: fallbackTitle, text: bodyFallback };
}
