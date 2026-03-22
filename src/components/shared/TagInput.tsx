import { useState, useRef } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1.5 min-h-[36px] cursor-text"
      style={{
        backgroundColor: "var(--surface-container)",
        border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-body-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--primary-fixed-dim) 15%, transparent)",
            color: "var(--primary-fixed-dim)",
            fontSize: "0.7rem",
          }}
        >
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="hover:opacity-70 transition-opacity"
            style={{ lineHeight: 1 }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
          if (e.key === "Backspace" && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
          }
        }}
        placeholder={tags.length === 0 ? "Add tags..." : ""}
        className="flex-1 min-w-[60px] bg-transparent text-body-sm outline-none"
        style={{ color: "var(--on-surface)" }}
      />
    </div>
  );
}
