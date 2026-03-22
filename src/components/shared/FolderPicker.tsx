import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  recentFolders?: string[];
}

export function FolderPicker({ value, onChange, recentFolders = [] }: FolderPickerProps) {
  const [showRecent, setShowRecent] = useState(false);

  const handleBrowse = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        onChange(selected);
      }
    } catch (e) {
      console.error("Folder picker error:", e);
    }
  };

  const displayPath = value
    ? value.length > 35
      ? "..." + value.slice(-32)
      : value
    : "Choose folder...";

  return (
    <div className="relative flex gap-1">
      <button
        onClick={handleBrowse}
        className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors duration-100"
        style={{
          backgroundColor: "var(--surface-container)",
          color: value ? "var(--on-surface)" : "var(--on-surface-variant)",
          border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--surface-container-high)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--surface-container)")
        }
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.6 }}
        >
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <span className="text-mono-sm truncate" style={{ fontSize: "0.7rem" }}>
          {displayPath}
        </span>
      </button>

      {recentFolders.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className="rounded-lg px-2 py-2 transition-colors duration-100"
            style={{
              backgroundColor: "var(--surface-container)",
              color: "var(--on-surface-variant)",
              border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--surface-container-high)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--surface-container)")
            }
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              style={{
                transform: showRecent ? "rotate(180deg)" : "none",
                transition: "transform 100ms",
              }}
            >
              <path d="M2 3.5L5 7L8 3.5" />
            </svg>
          </button>
          {showRecent && (
            <div
              className="absolute right-0 top-full mt-1 z-50 rounded-lg py-1"
              style={{
                backgroundColor: "var(--surface-container-highest)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                minWidth: 200,
              }}
            >
              {recentFolders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => {
                    onChange(folder);
                    setShowRecent(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-mono-sm transition-colors duration-100"
                  style={{ color: "var(--on-surface)", fontSize: "0.65rem" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "var(--surface-container)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  {folder.length > 40 ? "..." + folder.slice(-37) : folder}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
