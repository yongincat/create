import { useMemo, useState } from "react";
import { generatePost, type GenerateInputs } from "./lib/api";
import { getConfig } from "./lib/config";
import { TagInput } from "./components/TagInput";

const STYLE_PRESETS = [
  "Warm & Friendly",
  "Professional",
  "Cute & Playful",
  "Short & Punchy"
];

function getTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  return token && token.trim() ? token.trim() : null;
}

function clampCreativity(value: number) {
  if (Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, value));
}

export function App() {
  const config = getConfig();
  const token = useMemo(getTokenFromUrl, []);

  const [inputs, setInputs] = useState<GenerateInputs>({
    catName: "",
    ageValue: "",
    ageUnit: "months",
    sex: "unknown",
    neutered: "unknown",
    temperament: [],
    rescueStory: "",
    healthNotes: "",
    specialNeeds: "",
    adoptionRequirements: "",
    contact: ""
  });

  const [stylePreset, setStylePreset] = useState(STYLE_PRESETS[0]);
  const [creativity, setCreativity] = useState(50);
  const [output, setOutput] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const missingToken = !token;

  async function handleGenerate() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const response = await generatePost({
        token,
        inputs,
        stylePreset,
        creativity: clampCreativity(creativity)
      });
      setOutput(response.text);
      setTitle(response.title || "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof GenerateInputs>(key: K, value: GenerateInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function handleDownload() {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cat-adoption-post-${inputs.catName || "draft"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  }

  if (missingToken) {
    return (
      <div className="page">
        <header className="hero">
          <p className="eyebrow">Access Required</p>
          <h1>{config.appTitle}</h1>
          <p className="subtitle">
            This generator is available by invitation only. Please use the
            private link provided by the rescue team.
          </p>
          <div className="card info">
            <p>
              Add your access token as a query parameter, for example:
            </p>
            <code className="token-link">
              https://your-pages-site/?token=YOURTOKEN
            </code>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Adoption Story Builder</p>
        <h1>{config.appTitle}</h1>
        <p className="subtitle">
          Generate polished, ready-to-post adoption promos that keep facts
          consistent and highlight each cat's unique charm.
        </p>
      </header>

      <main className="grid">
        <section className="card form-card">
          <h2>Cat Details</h2>
          <div className="field-grid">
            <div className="field">
              <label className="label">Cat name</label>
              <input
                value={inputs.catName}
                onChange={(e) => update("catName", e.target.value)}
                placeholder="Mochi"
              />
            </div>
            <div className="field">
              <label className="label">Age</label>
              <div className="row">
                <input
                  value={inputs.ageValue}
                  onChange={(e) => update("ageValue", e.target.value)}
                  placeholder="8"
                />
                <select
                  value={inputs.ageUnit}
                  onChange={(e) =>
                    update("ageUnit", e.target.value as GenerateInputs["ageUnit"])
                  }
                >
                  <option value="months">months</option>
                  <option value="years">years</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label">Sex</label>
              <select
                value={inputs.sex}
                onChange={(e) =>
                  update("sex", e.target.value as GenerateInputs["sex"])
                }
              >
                <option value="female">female</option>
                <option value="male">male</option>
                <option value="unknown">unknown</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Neutered/Spayed</label>
              <select
                value={inputs.neutered}
                onChange={(e) =>
                  update("neutered", e.target.value as GenerateInputs["neutered"])
                }
              >
                <option value="yes">yes</option>
                <option value="no">no</option>
                <option value="unknown">unknown</option>
              </select>
            </div>
          </div>

          <TagInput
            label="Temperament tags"
            placeholder="gentle, curious, lap cat"
            value={inputs.temperament}
            onChange={(next) => update("temperament", next)}
          />

          <div className="field">
            <label className="label">Rescue story</label>
            <textarea
              rows={4}
              value={inputs.rescueStory}
              onChange={(e) => update("rescueStory", e.target.value)}
              placeholder="Found wandering near a neighborhood park..."
            />
          </div>

          <div className="field">
            <label className="label">Health notes</label>
            <textarea
              rows={3}
              value={inputs.healthNotes}
              onChange={(e) => update("healthNotes", e.target.value)}
              placeholder="Vaccinated, microchipped, treated for fleas."
            />
          </div>

          <div className="field">
            <label className="label">Special needs (optional)</label>
            <textarea
              rows={2}
              value={inputs.specialNeeds}
              onChange={(e) => update("specialNeeds", e.target.value)}
              placeholder="Requires a quiet home, daily eye drops, etc."
            />
          </div>

          <div className="field">
            <label className="label">Adoption requirements</label>
            <textarea
              rows={3}
              value={inputs.adoptionRequirements}
              onChange={(e) => update("adoptionRequirements", e.target.value)}
              placeholder="Indoor-only home, patient introductions to other pets..."
            />
          </div>

          <div className="field">
            <label className="label">Contact (optional)</label>
            <input
              value={inputs.contact}
              onChange={(e) => update("contact", e.target.value)}
              placeholder="Email or form link"
            />
          </div>

          <div className="field">
            <label className="label">Style preset</label>
            <select
              value={stylePreset}
              onChange={(e) => setStylePreset(e.target.value)}
            >
              {STYLE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label">Creativity: {creativity}</label>
            <input
              type="range"
              min={0}
              max={100}
              value={creativity}
              onChange={(e) => setCreativity(Number(e.target.value))}
            />
          </div>

          <button
            className="primary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate"}
          </button>

          {error && <div className="error">{error}</div>}
        </section>

        <section className="card output-card">
          <div className="output-header">
            <h2>Generated Post</h2>
            <span className="char-count">
              {output.length}/{config.maxOutputChars}
            </span>
          </div>

          <div className="output-body">
            {output ? (
              <div>
                {title && <h3 className="output-title">{title}</h3>}
                <pre>{output}</pre>
              </div>
            ) : (
              <p className="placeholder">
                Your generated adoption post will appear here.
              </p>
            )}
          </div>

          <div className="output-actions">
            <button onClick={handleCopy} disabled={!output}>
              Copy
            </button>
            <button onClick={handleGenerate} disabled={loading}>
              Regenerate
            </button>
            <button onClick={handleDownload} disabled={!output}>
              Download .txt
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
