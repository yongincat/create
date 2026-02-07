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
  outputLength: "short" | "medium" | "long";
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
  const lengthHint =
    payload.outputLength === "short"
      ? "about 500 characters"
      : payload.outputLength === "long"
        ? "about 2000 characters"
        : "about 1200 characters";

  return (
    `Style preset: ${stylePreset}\n\n` +
    `Target length: ${lengthHint}\n` +
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

  const maxOutputCharsBase = Number(process.env.MAX_OUTPUT_CHARS || 2500);
  const lengthCap =
    payload.outputLength === "short"
      ? 500
      : payload.outputLength === "long"
        ? 2000
        : 1200;
  const maxOutputChars = Math.min(maxOutputCharsBase, lengthCap);
  const prompt = buildPrompt(payload);
  const promptId = process.env.PROMPT_ID || "";

  if (!promptId) {
    return jsonResponse(
      { error: "PROMPT_ID 환경변수가 설정되어 있지 않습니다." },
      500,
      origin
    );
  }

  const openaiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: {
        id: promptId
      },
      max_output_tokens: Number(process.env.MAX_OUTPUT_TOKENS || 700),
      metadata: { prompt_id: promptId },
      text: {
        format: { type: "text" }
      },
      input: prompt,
      store: true
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
  const parsed = parseTitleAndBody(rawText);
  const limitedText = parsed.text.slice(0, maxOutputChars);
  const limitedTitle = parsed.title.slice(0, 120);

  return jsonResponse({ title: limitedTitle, text: limitedText }, 200, origin);
};

function parseTitleAndBody(text: string) {
  const cleanedInput = stripCodeFence(text).trim();
  const jsonParsed = tryParseJson(cleanedInput);
  if (jsonParsed) {
    return {
      title: String(jsonParsed.title || ""),
      text: String(jsonParsed.body || jsonParsed.text || "")
    };
  }

  const cleaned = text
    .replace(/^\s*Title:\s*/i, "")
    .replace(/\n?\s*Body:\s*/i, "\n");
  const fallbackLines = cleaned.split("\n").filter((line) => line.trim() !== "");
  const fallbackTitle = fallbackLines.length ? fallbackLines[0].trim() : "";

  const titleMatch = text.match(/Title:\\s*(.+)/i);
  const bodyMatch = text.match(/Body:\\s*([\\s\\S]*)/i);

  if (titleMatch && bodyMatch) {
    const title = titleMatch[1].trim();
    const body = bodyMatch[1].trim();
    return { title, text: body };
  }

  const bodyFallback = fallbackLines.length > 1
    ? fallbackLines.slice(1).join("\n").trim()
    : "";

  return { title: fallbackTitle, text: bodyFallback };
}

function stripCodeFence(text: string) {
  return text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function tryParseJson(text: string): { title?: string; text?: string; body?: string } | null {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText) as {
      title?: string;
      text?: string;
      body?: string;
    };
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start === -1) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\\\") {
      escaped = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return "";
}
