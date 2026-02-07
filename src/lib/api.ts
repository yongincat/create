import { getConfig } from "./config";

export type GenerateInputs = {
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

export type GenerateRequest = {
  token: string;
  inputs: GenerateInputs;
  stylePreset: string;
  creativity: number;
};

export type GenerateResponse = {
  title?: string;
  text: string;
};

export type AdminVerifyResponse = {
  ok: boolean;
};

export async function generatePost(
  payload: GenerateRequest
): Promise<GenerateResponse> {
  const config = getConfig();
  const res = await fetch(`${config.backendBaseUrl}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // ignore json parse errors
    }
    throw new Error(`${message} (상태 ${res.status})`);
  }

  return (await res.json()) as GenerateResponse;
}

export async function verifyAdmin(password: string): Promise<AdminVerifyResponse> {
  const config = getConfig();
  const res = await fetch(`${config.backendBaseUrl}/admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password })
  });

  if (!res.ok) {
    let message = "관리자 인증 실패";
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // ignore json parse errors
    }
    throw new Error(`${message} (상태 ${res.status})`);
  }

  return (await res.json()) as AdminVerifyResponse;
}
