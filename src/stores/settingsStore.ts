import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "custom";

export interface Settings {
  theme: ThemeMode;
  defaultSavePath: string;
  clipboardEnabled: boolean;
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
  globalSpeedLimit: 0,
  maxConcurrent: 5,
  defaultChunks: 8,
  retryCount: 3,
  launchOnBoot: false,
  minimizeToTray: true,
  chunkThresholdBytes: 1048576,
};

interface SettingsState {
  settings: Settings;
  setSettings: (settings: Partial<Settings>) => void;
  setTheme: (theme: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,

  setSettings: (patch) =>
    set((state) => ({
      settings: { ...state.settings, ...patch },
    })),

  setTheme: (theme) =>
    set((state) => {
      document.documentElement.setAttribute("data-theme", theme);
      return { settings: { ...state.settings, theme } };
    }),
}));
