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

  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminPassword) {
    return jsonResponse({ error: "관리자 설정이 필요합니다." }, 500, origin);
  }

  let payload: { password?: string };
  try {
    payload = JSON.parse(event.body || "{}") as { password?: string };
  } catch {
    return jsonResponse({ error: "요청 형식이 올바르지 않습니다." }, 400, origin);
  }

  if (!payload?.password || payload.password !== adminPassword) {
    return jsonResponse({ error: "관리자 비밀번호가 일치하지 않습니다." }, 401, origin);
  }

  return jsonResponse({ ok: true }, 200, origin);
};
