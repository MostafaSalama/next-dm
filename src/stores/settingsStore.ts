import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type ThemeMode = "dark" | "light" | "custom";

export interface Settings {
  theme: ThemeMode;
  defaultSavePath: string;
  clipboardEnabled: boolean;
  clipboardAutoAdd: boolean;
  globalSpeedLimit: number;
  maxConcurrent: number;
  defaultChunks: number;
  retryCount: number;
  launchOnBoot: boolean;
  minimizeToTray: boolean;
  chunkThresholdBytes: number;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  defaultSavePath: "",
  clipboardEnabled: true,
  clipboardAutoAdd: false,
  globalSpeedLimit: 0,
  maxConcurrent: 5,
  defaultChunks: 8,
  retryCount: 3,
  launchOnBoot: false,
  minimizeToTray: true,
  chunkThresholdBytes: 1048576,
};

const KEY_MAP: Record<string, keyof Settings> = {
  theme: "theme",
  default_save_path: "defaultSavePath",
  clipboard_enabled: "clipboardEnabled",
  clipboard_auto_add: "clipboardAutoAdd",
  global_speed_limit: "globalSpeedLimit",
  max_concurrent: "maxConcurrent",
  default_chunks: "defaultChunks",
  retry_count: "retryCount",
  launch_on_boot: "launchOnBoot",
  minimize_to_tray: "minimizeToTray",
  chunk_threshold_bytes: "chunkThresholdBytes",
};

const REVERSE_KEY_MAP: Record<keyof Settings, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k]),
) as Record<keyof Settings, string>;

function parseValue(key: keyof Settings, raw: string): unknown {
  switch (key) {
    case "theme":
    case "defaultSavePath":
      return raw;
    case "clipboardEnabled":
    case "clipboardAutoAdd":
    case "launchOnBoot":
    case "minimizeToTray":
      return raw === "true" || raw === "1";
    default:
      return Number(raw) || 0;
  }
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  setSettings: (settings: Partial<Settings>) => void;
  setTheme: (theme: ThemeMode) => void;
  loadSettings: () => Promise<void>;
  saveSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  setSettings: (patch) =>
    set((state) => ({
      settings: { ...state.settings, ...patch },
    })),

  setTheme: (theme) =>
    set((state) => {
      document.documentElement.setAttribute("data-theme", theme);
      return { settings: { ...state.settings, theme } };
    }),

  loadSettings: async () => {
    try {
      const raw = await invoke<Record<string, string>>("get_all_settings");
      const patch: Partial<Settings> = {};
      for (const [dbKey, val] of Object.entries(raw)) {
        const storeKey = KEY_MAP[dbKey];
        if (storeKey) {
          (patch as Record<string, unknown>)[storeKey] = parseValue(storeKey, val);
        }
      }
      set((state) => ({
        settings: { ...state.settings, ...patch },
        loaded: true,
      }));
      const theme = (patch.theme as ThemeMode) || get().settings.theme;
      document.documentElement.setAttribute("data-theme", theme);
    } catch (err) {
      console.error("Failed to load settings:", err);
      set({ loaded: true });
    }
  },

  saveSetting: async (key, value) => {
    const dbKey = REVERSE_KEY_MAP[key] || key;
    try {
      await invoke("update_setting", { key: dbKey, value: String(value) });
      set((state) => ({
        settings: { ...state.settings, [key]: value },
      }));
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err);
    }
  },
}));
