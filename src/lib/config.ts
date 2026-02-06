export type PublicConfig = {
  backendBaseUrl: string;
  appTitle: string;
  heroEyebrow: string;
  heroSubtitle: string;
  accessTitle: string;
  accessSubtitle: string;
  accessHint: string;
  accessExampleUrl: string;
  maxOutputChars: number;
};

type ConfigState = {
  loaded: boolean;
  config: PublicConfig | null;
};

const state: ConfigState = {
  loaded: false,
  config: null
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function loadConfig(): Promise<PublicConfig> {
  if (state.loaded && state.config) return state.config;

  const publicConfig = await fetchJson<PublicConfig>("/config.public.json");
  let merged = { ...publicConfig };

  if (import.meta.env.DEV) {
    try {
      const localConfig = await fetchJson<Partial<PublicConfig>>(
        "/config.local.json"
      );
      merged = { ...merged, ...localConfig };
    } catch {
      // Optional in dev; ignore if missing.
    }
  }

  if (!merged.backendBaseUrl) {
    throw new Error("backendBaseUrl is missing in config.public.json");
  }

  state.loaded = true;
  state.config = merged as PublicConfig;
  return state.config;
}

export function getConfig(): PublicConfig {
  if (!state.config) {
    throw new Error("Config not loaded. Call loadConfig() first.");
  }
  return state.config;
}
