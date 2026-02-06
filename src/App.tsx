import { useMemo, useState } from "react";
import { generatePost, type GenerateInputs } from "./lib/api";
import { getConfig } from "./lib/config";
import { TagInput } from "./components/TagInput";

const STYLE_PRESETS = [
  "따뜻하고 친근하게",
  "전문적이고 신뢰감 있게",
  "귀엽고 발랄하게",
  "짧고 강렬하게"
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
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
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
          <p className="eyebrow">{config.accessTitle}</p>
          <h1>{config.appTitle}</h1>
          <p className="subtitle">
            {config.accessSubtitle}
          </p>
          <div className="card info">
            <p>{config.accessHint}</p>
            <code className="token-link">
              {config.accessExampleUrl}
            </code>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">{config.heroEyebrow}</p>
        <h1>{config.appTitle}</h1>
        {config.heroSubtitle.split("\n").map((line, index) => (
          <p className="subtitle" key={`hero-sub-${index}`}>
            {line}
          </p>
        ))}
      </header>

      <main className="grid">
        <section className="card form-card">
          <h2>고양이 정보</h2>
          <div className="field-grid">
            <div className="field">
              <label className="label">이름</label>
              <input
                value={inputs.catName}
                onChange={(e) => update("catName", e.target.value)}
                placeholder="모찌"
              />
            </div>
            <div className="field">
              <label className="label">나이</label>
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
                  <option value="months">개월</option>
                  <option value="years">년</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label">성별</label>
              <select
                value={inputs.sex}
                onChange={(e) =>
                  update("sex", e.target.value as GenerateInputs["sex"])
                }
              >
                <option value="female">암컷</option>
                <option value="male">수컷</option>
                <option value="unknown">미상</option>
              </select>
            </div>
            <div className="field">
              <label className="label">중성화 여부</label>
              <select
                value={inputs.neutered}
                onChange={(e) =>
                  update("neutered", e.target.value as GenerateInputs["neutered"])
                }
              >
                <option value="yes">완료</option>
                <option value="no">미완료</option>
                <option value="unknown">미상</option>
              </select>
            </div>
          </div>

          <TagInput
            label="성격 태그"
            placeholder="온순함, 호기심, 무릎냥이"
            value={inputs.temperament}
            onChange={(next) => update("temperament", next)}
          />

          <div className="field">
            <label className="label">구조 이야기</label>
            <textarea
              rows={4}
              value={inputs.rescueStory}
              onChange={(e) => update("rescueStory", e.target.value)}
              placeholder="동네 공원 근처에서 발견됐어요..."
            />
          </div>

          <div className="field">
            <label className="label">건강 정보</label>
            <textarea
              rows={3}
              value={inputs.healthNotes}
              onChange={(e) => update("healthNotes", e.target.value)}
              placeholder="접종 완료, 마이크로칩 등록, 구충 완료"
            />
          </div>

          <div className="field">
            <label className="label">특이사항 (선택)</label>
            <textarea
              rows={2}
              value={inputs.specialNeeds}
              onChange={(e) => update("specialNeeds", e.target.value)}
              placeholder="조용한 환경 필요, 안약 매일 사용 등"
            />
          </div>

          <div className="field">
            <label className="label">입양 조건</label>
            <textarea
              rows={3}
              value={inputs.adoptionRequirements}
              onChange={(e) => update("adoptionRequirements", e.target.value)}
              placeholder="실내 생활, 다른 반려동물과 천천히 합사"
            />
          </div>

          <div className="field">
            <label className="label">연락처 (선택)</label>
            <input
              value={inputs.contact}
              onChange={(e) => update("contact", e.target.value)}
              placeholder="이메일 또는 신청 폼 링크"
            />
          </div>

          <div className="field">
            <label className="label">문체</label>
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
            <label className="label">창의성: {creativity}</label>
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
            {loading ? "생성 중..." : "홍보문 생성"}
          </button>

          {error && <div className="error">{error}</div>}
        </section>

        <section className="card output-card">
          <div className="output-header">
            <h2>생성 결과</h2>
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
                생성된 홍보문이 여기에 표시됩니다.
              </p>
            )}
          </div>

          <div className="output-actions">
            <button onClick={handleCopy} disabled={!output}>
              복사
            </button>
            <button onClick={handleGenerate} disabled={loading}>
              다시 생성
            </button>
            <button onClick={handleDownload} disabled={!output}>
              TXT로 저장
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
