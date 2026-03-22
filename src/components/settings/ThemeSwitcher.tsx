import { useState, useCallback } from "react";
import { useSettingsStore, type ThemeMode } from "../../stores/settingsStore";

const CUSTOM_TOKENS = [
  { key: "--surface", label: "Surface" },
  { key: "--surface-container", label: "Container" },
  { key: "--primary-fixed", label: "Primary" },
  { key: "--primary-fixed-dim", label: "Primary Dim" },
  { key: "--on-surface", label: "Text" },
  { key: "--on-surface-variant", label: "Text Variant" },
  { key: "--error", label: "Error" },
] as const;

interface ThemeCard {
  mode: ThemeMode;
  label: string;
  colors: string[];
}

const THEME_CARDS: ThemeCard[] = [
  {
    mode: "dark",
    label: "Dark",
    colors: ["#041329", "#38DEBB", "#E1E2E8"],
  },
  {
    mode: "light",
    label: "Light",
    colors: ["#F8FAFB", "#00695C", "#1A1C1E"],
  },
  {
    mode: "custom",
    label: "Custom",
    colors: ["#1a1a2e", "#e94560", "#eaeaea"],
  },
];

function getStoredCustomTheme(): Record<string, string> {
  try {
    const raw = localStorage.getItem("custom_theme");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function applyCustomTheme(theme: Record<string, string>) {
  const html = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    html.style.setProperty(key, value);
  }
}

function clearCustomTheme() {
  const html = document.documentElement;
  for (const t of CUSTOM_TOKENS) {
    html.style.removeProperty(t.key);
  }
}

export function ThemeSwitcher() {
  const settings = useSettingsStore((s) => s.settings);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const saveSetting = useSettingsStore((s) => s.saveSetting);

  const [customColors, setCustomColors] = useState<Record<string, string>>(
    getStoredCustomTheme,
  );
  const [showCustomPanel, setShowCustomPanel] = useState(settings.theme === "custom");

  const handleSelectTheme = useCallback(
    (mode: ThemeMode) => {
      clearCustomTheme();
      setTheme(mode);
      saveSetting("theme", mode);
      setShowCustomPanel(mode === "custom");
      if (mode === "custom") {
        applyCustomTheme(customColors);
      }
    },
    [setTheme, saveSetting, customColors],
  );

  const handleColorChange = useCallback(
    (token: string, color: string) => {
      const next = { ...customColors, [token]: color };
      setCustomColors(next);
      document.documentElement.style.setProperty(token, color);
      localStorage.setItem("custom_theme", JSON.stringify(next));
      saveSetting("theme", "custom");
    },
    [customColors, saveSetting],
  );

  const handleExport = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(customColors, null, 2));
  }, [customColors]);

  const handleImport = useCallback(() => {
    navigator.clipboard.readText().then((text) => {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "object" && parsed !== null) {
          setCustomColors(parsed);
          localStorage.setItem("custom_theme", JSON.stringify(parsed));
          applyCustomTheme(parsed);
          setTheme("custom");
          saveSetting("theme", "custom");
          setShowCustomPanel(true);
        }
      } catch {
        console.error("Invalid theme JSON");
      }
    });
  }, [setTheme, saveSetting]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        {THEME_CARDS.map((card) => {
          const active = settings.theme === card.mode;
          return (
            <button
              key={card.mode}
              onClick={() => handleSelectTheme(card.mode)}
              className="flex flex-col items-center gap-2 rounded-xl p-3 transition-all duration-150"
              style={{
                flex: 1,
                backgroundColor: active
                  ? "var(--surface-container-high)"
                  : "var(--surface-container)",
                border: active
                  ? "2px solid var(--primary-fixed-dim)"
                  : "2px solid transparent",
              }}
            >
              <div className="flex gap-1">
                {card.colors.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: c,
                      border: "1px solid rgba(128,128,128,0.3)",
                    }}
                  />
                ))}
              </div>
              <span
                className="text-body-sm"
                style={{
                  color: active
                    ? "var(--primary-fixed)"
                    : "var(--on-surface-variant)",
                }}
              >
                {card.label}
              </span>
            </button>
          );
        })}
      </div>

      {showCustomPanel && (
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: "var(--surface-container)" }}
        >
          <span
            className="text-label-md"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Custom Colors
          </span>

          <div className="grid grid-cols-2 gap-3">
            {CUSTOM_TOKENS.map((t) => (
              <label key={t.key} className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColors[t.key] || "#000000"}
                  onChange={(e) => handleColorChange(t.key, e.target.value)}
                  className="rounded cursor-pointer"
                  style={{ width: 28, height: 28, border: "none", padding: 0 }}
                />
                <span
                  className="text-body-sm"
                  style={{ color: "var(--on-surface-variant)" }}
                >
                  {t.label}
                </span>
              </label>
            ))}
          </div>

          <div className="flex gap-2 mt-1">
            <button
              onClick={handleExport}
              className="rounded-lg px-3 py-1.5 text-body-sm transition-colors duration-100"
              style={{
                backgroundColor: "var(--surface-container-high)",
                color: "var(--primary-fixed-dim)",
              }}
            >
              Export JSON
            </button>
            <button
              onClick={handleImport}
              className="rounded-lg px-3 py-1.5 text-body-sm transition-colors duration-100"
              style={{
                backgroundColor: "var(--surface-container-high)",
                color: "var(--primary-fixed-dim)",
              }}
            >
              Import JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
