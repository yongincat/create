import { useMemo, useState } from "react";
import type React from "react";

export type TagInputProps = {
  label: string;
  placeholder?: string;
  value: string[];
  onChange: (next: string[]) => void;
};

function normalizeTag(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function TagInput({ label, placeholder, value, onChange }: TagInputProps) {
  const [draft, setDraft] = useState("");

  const tags = useMemo(() => value.filter(Boolean), [value]);

  function addTag(raw: string) {
    const tag = normalizeTag(raw);
    if (!tag) return;
    if (tags.includes(tag)) return;
    onChange([...tags, tag]);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
      setDraft("");
    }
    if (e.key === "Backspace" && !draft && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="field">
      <label className="label">{label}</label>
      <div className="tag-input">
        {tags.map((tag) => (
          <span className="tag" key={tag}>
            {tag}
            <button
              type="button"
              className="tag-remove"
              onClick={() => removeTag(tag)}
              aria-label={`${tag} 삭제`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="hint">엔터 또는 , 를 눌러 태그를 추가하세요.</div>
    </div>
  );
}
