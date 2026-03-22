import { useState, useRef, useEffect } from "react";
import { AVAILABLE_TOKENS } from "../../lib/naming";

interface PatternInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function PatternInput({ value, onChange }: PatternInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const pos = e.currentTarget.selectionStart ?? 0;
    setCursorPos(pos);
    const textBefore = value.slice(0, pos);
    if (textBefore.endsWith("{")) {
      setShowDropdown(true);
    }
  };

  const insertToken = (token: string) => {
    const textBefore = value.slice(0, cursorPos);
    const textAfter = value.slice(cursorPos);
    const endsWithBrace = textBefore.endsWith("{");
    const before = endsWithBrace ? textBefore.slice(0, -1) : textBefore;
    const newValue = before + token + textAfter;
    onChange(newValue);
    setShowDropdown(false);
    setTimeout(() => {
      const newPos = before.length + token.length;
      inputRef.current?.setSelectionRange(newPos, newPos);
      inputRef.current?.focus();
    }, 0);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={handleKeyUp}
        placeholder="{original}{ext}"
        className="w-full rounded-lg px-3 py-2 text-body-sm outline-none font-mono"
        style={{
          backgroundColor: "var(--surface-container)",
          color: "var(--on-surface)",
          border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
        }}
      />

      {showDropdown && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-lg py-1 w-full"
          style={{
            backgroundColor: "var(--surface-container-highest)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {AVAILABLE_TOKENS.map((t) => (
            <button
              key={t.token}
              onClick={() => insertToken(t.token)}
              className="w-full text-left px-3 py-1.5 text-body-sm flex items-center gap-2 transition-colors duration-100"
              style={{ color: "var(--on-surface)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--surface-container)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <code
                className="text-mono-sm px-1 rounded"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--primary-fixed-dim) 15%, transparent)",
                  color: "var(--primary-fixed-dim)",
                }}
              >
                {t.token}
              </code>
              <span style={{ color: "var(--on-surface-variant)", fontSize: "0.7rem" }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mt-1.5">
        {AVAILABLE_TOKENS.map((t) => (
          <button
            key={t.token}
            onClick={() => {
              onChange(value + t.token);
              inputRef.current?.focus();
            }}
            className="text-mono-sm px-1.5 py-0.5 rounded transition-colors duration-100"
            style={{
              backgroundColor: "color-mix(in srgb, var(--primary-fixed-dim) 10%, transparent)",
              color: "var(--primary-fixed-dim)",
              fontSize: "0.6rem",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--primary-fixed-dim) 10%, transparent)")
            }
          >
            {t.token}
          </button>
        ))}
      </div>
    </div>
  );
}
