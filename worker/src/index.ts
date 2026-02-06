export interface Env {
  OPENAI_API_KEY: string;
  ALLOWED_TOKENS: string;
  ALLOWED_ORIGIN: string;
  MAX_OUTPUT_CHARS?: string;
}

type GenerateRequest = {
  token: string;
  inputs: {
    catName: string;
    ageValue: string;
    ageUnit: "months" | "years";
    sex: "male" | "female" | "unknown";
    neutered: "yes" | "no" | "unknown";
    temperament: string[];
    rescueStory: string;
    healthNotes: string;
    specialNeeds?: string;
    adoptionRequirements: string;
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

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  origin?: string
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {})
    }
  });
}

function getAllowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "";
  if (origin && env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN) {
    return origin;
  }
  return "";
}

function handleOptions(request: Request, env: Env) {
  const origin = getAllowedOrigin(request, env);
  if (!origin) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}

function normalizeTokens(raw: string) {
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function isAllowedToken(token: string, env: Env) {
  const allowed = normalizeTokens(env.ALLOWED_TOKENS || "");
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
  const temperament = inputs.temperament?.length
    ? inputs.temperament.join(", ")
    : "Not specified";

  return `Style preset: ${stylePreset}\n\n` +
    `Cat name: ${inputs.catName || "Not specified"}\n` +
    `Age: ${inputs.ageValue || "Not specified"} ${inputs.ageUnit}\n` +
    `Sex: ${inputs.sex}\n` +
    `Neutered/Spayed: ${inputs.neutered}\n` +
    `Temperament: ${temperament}\n` +
    `Rescue story: ${inputs.rescueStory || "Not specified"}\n` +
    `Health notes: ${inputs.healthNotes || "Not specified"}\n` +
    `Special needs: ${inputs.specialNeeds || "None"}\n` +
    `Adoption requirements: ${inputs.adoptionRequirements || "Not specified"}\n` +
    `Contact: ${inputs.contact || "Not specified"}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    const url = new URL(request.url);
    if (url.pathname !== "/generate") {
      return new Response("Not Found", { status: 404 });
    }

    const origin = getAllowedOrigin(request, env);
    if (!origin) {
      return jsonResponse({ error: "Origin not allowed" }, 403);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, origin);
    }

    let payload: GenerateRequest;
    try {
      payload = (await request.json()) as GenerateRequest;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400, origin);
    }

    if (!payload?.token || !isAllowedToken(payload.token, env)) {
      return jsonResponse({ error: "Unauthorized" }, 401, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const tokenOk = withinRateLimit(tokenBuckets, payload.token);
    const ipOk = withinRateLimit(ipBuckets, ip);
    if (!tokenOk || !ipOk) {
      return jsonResponse({ error: "Rate limit exceeded" }, 429, origin);
    }

    const maxOutputChars = Number(env.MAX_OUTPUT_CHARS || 2500);
    const temperature = mapCreativity(payload.creativity || 0);

    const system = `You create cat adoption promotion posts.\n` +
      `Follow this exact structure:\n` +
      `1) Title line.\n` +
      `2) 3-6 short paragraphs.\n` +
      `3) Facts bullet list with age, sex, neutered/spayed, and health.\n` +
      `4) Clear call-to-action ending.\n` +
      `Keep tone consistent with the style preset.\n` +
      `Avoid medical guarantees and do not invent personal data.\n` +
      `Only use the contact info provided.`;

    const prompt = buildPrompt(payload);

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature,
        top_p: Math.min(1, 0.9 + temperature * 0.1),
        max_output_tokens: 700,
        input: [
          { role: "system", content: system },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      return jsonResponse({ error: `OpenAI error: ${text}` }, 502, origin);
    }

    const data = (await openaiRes.json()) as {
      output_text?: string;
    };

    const rawText = data.output_text || "";
    const trimmed = rawText.slice(0, maxOutputChars);

    return jsonResponse({ text: trimmed }, 200, origin);
  }
};
