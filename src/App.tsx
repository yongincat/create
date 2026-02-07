import { useMemo, useState } from "react";
import { generatePost, verifyAdmin, type GenerateInputs } from "./lib/api";
import { getConfig } from "./lib/config";

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

type HistoryItem = {
  id: string;
  createdAt: string;
  inputs: GenerateInputs;
  stylePreset: string;
  creativity: number;
  title?: string;
  text?: string;
};

const HISTORY_KEY = "cat-adoption-history";
const ADMIN_CACHE_KEY = "cat-adoption-admin-cache";
const ADMIN_CACHE_TTL_MS = 15 * 60 * 1000;

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

function getAdminCacheValid(): boolean {
  try {
    const raw = sessionStorage.getItem(ADMIN_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { verifiedAt: number };
    if (!parsed?.verifiedAt) return false;
    return Date.now() - parsed.verifiedAt < ADMIN_CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function setAdminCache() {
  sessionStorage.setItem(
    ADMIN_CACHE_KEY,
    JSON.stringify({ verifiedAt: Date.now() })
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ko-KR");
}

export function App() {
  const config = getConfig();
  const token = useMemo(getTokenFromUrl, []);
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);

  const [inputs, setInputs] = useState<GenerateInputs>({
    catName: "",
    ageValue: "",
    ageUnit: "months",
    sex: "unknown",
    neutered: "unknown",
    temperament: "",
    rescueStory: "",
    healthNotes: "",
    specialNeeds: "",
    contact: ""
  });

  const [stylePreset, setStylePreset] = useState(STYLE_PRESETS[0]);
  const [creativity, setCreativity] = useState(50);
  const [output, setOutput] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

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
      const nextItem: HistoryItem = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        inputs,
        stylePreset,
        creativity: clampCreativity(creativity),
        title: response.title,
        text: response.text
      };
      const nextHistory = [nextItem, ...history].slice(0, 50);
      setHistory(nextHistory);
      saveHistory(nextHistory);
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyAdminPassword(): Promise<boolean> {
    setAdminError(null);
    if (getAdminCacheValid()) return true;
    const password = window.prompt("관리자 비밀번호를 입력하세요.");
    if (!password) return false;
    try {
      await verifyAdmin(password);
      setAdminCache();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "관리자 인증 실패";
      setAdminError(message);
      return false;
    }
  }

  async function handleVerifyAndClearHistory() {
    const ok = await verifyAdminPassword();
    if (!ok) return;
    setHistory([]);
    saveHistory([]);
  }

  async function handleDeleteHistoryItem(id: string) {
    const ok = await verifyAdminPassword();
    if (!ok) return;
    const next = history.filter((item) => item.id !== id);
    setHistory(next);
    saveHistory(next);
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

      <div className="tabs">
        <button
          className={activeTab === "generate" ? "tab active" : "tab"}
          onClick={() => setActiveTab("generate")}
        >
          입양글 생성
        </button>
        <button
          className={activeTab === "history" ? "tab active" : "tab"}
          onClick={() => setActiveTab("history")}
        >
          이전 기록 살펴보기
        </button>
      </div>

      <main className="grid">
        {activeTab === "generate" ? (
          <>
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

          <div className="field">
            <label className="label">성격 한줄 설명</label>
            <input
              value={inputs.temperament}
              onChange={(e) => update("temperament", e.target.value)}
              placeholder="예: 사람을 좋아하고 장난감을 잘 쫓아요"
            />
          </div>

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
            <label className="label">특이사항</label>
            <textarea
              rows={5}
              value={inputs.specialNeeds}
              onChange={(e) => update("specialNeeds", e.target.value)}
              placeholder="건강, 생활 습관, 환경 요구 등 자유롭게 자세히 적어주세요."
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
        </>
        ) : (
          <section className="card history-card">
            <div className="history-header">
              <h2>이전 기록</h2>
              <div className="history-actions">
                <span className="history-count">{history.length}건</span>
                <button className="ghost" onClick={handleVerifyAndClearHistory}>
                  기록 전체 삭제
                </button>
              </div>
            </div>
            {adminError && <div className="error">{adminError}</div>}
            {history.length === 0 ? (
              <p className="placeholder">아직 저장된 기록이 없습니다.</p>
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <div className="history-item" key={item.id}>
                    <div className="history-meta">
                      <div className="history-title">
                        {item.title || item.inputs.catName || "제목 없음"}
                      </div>
                      <div className="history-meta-right">
                        <div className="history-date">
                          {formatDate(item.createdAt)}
                        </div>
                        <button
                          className="ghost"
                          onClick={() => handleDeleteHistoryItem(item.id)}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <div className="history-grid">
                      <div className="history-field">
                        <span className="history-label">이름</span>
                        <span className="history-value">{item.inputs.catName || "-"}</span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">나이</span>
                        <span className="history-value">
                          {item.inputs.ageValue || "-"} {item.inputs.ageUnit === "months" ? "개월" : "년"}
                        </span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">성별</span>
                        <span className="history-value">{item.inputs.sex}</span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">중성화</span>
                        <span className="history-value">{item.inputs.neutered}</span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">성격</span>
                        <span className="history-value">{item.inputs.temperament || "-"}</span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">구조 이야기</span>
                        <span className="history-value">{item.inputs.rescueStory || "-"}</span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">건강 정보</span>
                        <span className="history-value">{item.inputs.healthNotes || "-"}</span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">특이사항</span>
                        <span className="history-value">{item.inputs.specialNeeds || "-"}</span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">연락처</span>
                        <span className="history-value">{item.inputs.contact || "-"}</span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">문체</span>
                        <span className="history-value">{item.stylePreset}</span>
                      </div>
                      <div className="history-field">
                        <span className="history-label">창의성</span>
                        <span className="history-value">{item.creativity}</span>
                      </div>
                    </div>
                    {item.text && (
                      <div className="history-output">
                        <div className="history-label">생성 결과</div>
                        <pre>{item.text}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
