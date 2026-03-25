import { useSettingsStore } from "../../stores/settingsStore";
import { FolderPicker } from "../shared/FolderPicker";
import { SpeedLimiter } from "./SpeedLimiter";
import { ThemeSwitcher } from "./ThemeSwitcher";

function SectionHeader({ title }: { title: string }) {
  return (
    <h3
      className="text-label-lg mb-3"
      style={{ color: "var(--primary-fixed-dim)" }}
    >
      {title}
    </h3>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex flex-col">
        <span className="text-body-sm" style={{ color: "var(--on-surface)" }}>
          {label}
        </span>
        {hint && (
          <span
            className="text-body-sm"
            style={{ color: "var(--on-surface-variant)", fontSize: "0.65rem" }}
          >
            {hint}
          </span>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative rounded-full transition-colors duration-150"
      style={{
        width: 40,
        height: 22,
        backgroundColor: value
          ? "var(--primary-fixed-dim)"
          : "var(--surface-container-highest)",
      }}
    >
      <div
        className="absolute top-0.5 rounded-full transition-all duration-150"
        style={{
          width: 18,
          height: 18,
          backgroundColor: value ? "var(--on-primary)" : "var(--on-surface-variant)",
          left: value ? 19 : 3,
        }}
      />
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!isNaN(n) && n >= min && n <= max) onChange(n);
      }}
      className="rounded-lg px-2 py-1.5 text-body-sm text-right outline-none"
      style={{
        width: 72,
        backgroundColor: "var(--surface-container)",
        color: "var(--on-surface)",
        border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 30%, transparent)",
      }}
    />
  );
}

export function SettingsView() {
  const settings = useSettingsStore((s) => s.settings);
  const saveSetting = useSettingsStore((s) => s.saveSetting);

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <div className="max-w-2xl mx-auto px-8 py-8 flex flex-col gap-8">
        <h2
          className="text-display-sm"
          style={{ color: "var(--on-surface)", lineHeight: 1 }}
        >
          Settings
        </h2>

        {/* General */}
        <section>
          <SectionHeader title="General" />
          <div
            className="rounded-xl p-4 flex flex-col"
            style={{ backgroundColor: "var(--surface-container-low)" }}
          >
            <div className="mb-3">
              <span
                className="text-body-sm mb-1 block"
                style={{ color: "var(--on-surface)" }}
              >
                Default Save Folder
              </span>
              <FolderPicker
                value={settings.defaultSavePath}
                onChange={(path) => saveSetting("defaultSavePath", path)}
              />
            </div>
            <SettingRow label="Clipboard monitoring" hint="Detect URLs copied to clipboard">
              <Toggle
                value={settings.clipboardEnabled}
                onChange={(v) => saveSetting("clipboardEnabled", v)}
              />
            </SettingRow>
            <SettingRow
              label="Auto-add clipboard URLs"
              hint="Automatically add detected URLs to the default queue"
            >
              <Toggle
                value={settings.clipboardAutoAdd}
                onChange={(v) => saveSetting("clipboardAutoAdd", v)}
              />
            </SettingRow>
            <SettingRow label="Launch on boot">
              <Toggle
                value={settings.launchOnBoot}
                onChange={(v) => saveSetting("launchOnBoot", v)}
              />
            </SettingRow>
            <SettingRow label="Minimize to tray">
              <Toggle
                value={settings.minimizeToTray}
                onChange={(v) => saveSetting("minimizeToTray", v)}
              />
            </SettingRow>
          </div>
        </section>

        {/* Downloads */}
        <section>
          <SectionHeader title="Downloads" />
          <div
            className="rounded-xl p-4 flex flex-col"
            style={{ backgroundColor: "var(--surface-container-low)" }}
          >
            <SettingRow label="Max concurrent downloads" hint="Requires restart to take effect">
              <NumberInput
                value={settings.maxConcurrent}
                min={1}
                max={20}
                onChange={(v) => saveSetting("maxConcurrent", v)}
              />
            </SettingRow>
            <SettingRow label="Default chunks per file">
              <NumberInput
                value={settings.defaultChunks}
                min={1}
                max={32}
                onChange={(v) => saveSetting("defaultChunks", v)}
              />
            </SettingRow>
            <SettingRow label="Retry count">
              <NumberInput
                value={settings.retryCount}
                min={0}
                max={10}
                onChange={(v) => saveSetting("retryCount", v)}
              />
            </SettingRow>
            <SettingRow
              label="Chunk threshold"
              hint="Files below this size use single chunk (bytes)"
            >
              <NumberInput
                value={settings.chunkThresholdBytes}
                min={0}
                max={104857600}
                onChange={(v) => saveSetting("chunkThresholdBytes", v)}
              />
            </SettingRow>
          </div>
        </section>

        {/* Speed */}
        <section>
          <SectionHeader title="Speed" />
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--surface-container-low)" }}
          >
            <span
              className="text-body-sm mb-2 block"
              style={{ color: "var(--on-surface)" }}
            >
              Global Speed Limit
            </span>
            <SpeedLimiter
              value={settings.globalSpeedLimit}
              onChange={(v) => saveSetting("globalSpeedLimit", v)}
            />
          </div>
        </section>

        {/* Appearance */}
        <section>
          <SectionHeader title="Appearance" />
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--surface-container-low)" }}
          >
            <ThemeSwitcher />
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section>
          <SectionHeader title="Keyboard Shortcuts" />
          <div
            className="rounded-xl p-4 flex flex-col gap-0"
            style={{ backgroundColor: "var(--surface-container-low)" }}
          >
            <ShortcutRow keys={["Ctrl", "V"]} description="Paste URLs and open Pre-Flight modal" />
            <ShortcutRow keys={["Ctrl", ","]} description="Toggle Settings" />
            <ShortcutRow keys={["Ctrl", "A"]} description="Select all visible tasks" />
            <ShortcutRow keys={["Ctrl", "Enter"]} description="Add URLs in Pre-Flight textarea" />
            <ShortcutRow keys={["Shift", "Click"]} description="Select range of tasks" />
            <ShortcutRow keys={["Escape"]} description="Close modal / cancel edit" />
          </div>
        </section>

        {/* How It Works */}
        <section>
          <SectionHeader title="How It Works" />
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ backgroundColor: "var(--surface-container-low)" }}
          >
            <InfoBlock
              title="Clipboard Monitoring"
              text="When enabled, Next DM watches your clipboard for URLs. Detected links appear as toast notifications so you can add them to a queue or download immediately."
            />
            <InfoBlock
              title="Multi-Part Downloads"
              text="Large files are split into multiple chunks and downloaded in parallel, then stitched back together. This maximizes bandwidth and supports resuming interrupted downloads."
            />
            <InfoBlock
              title="Queues"
              text="Organize downloads into queues with per-queue concurrency limits, speed caps, and save folders. Right-click a queue for options like pause, clear, or rename."
            />
            <InfoBlock
              title="Batch Naming"
              text="In the Pre-Flight modal, use pattern tokens like {original}, {index}, {ext}, {queue}, and {tags} to rename multiple files at once before downloading."
            />
            <InfoBlock
              title="Archive"
              text="Move completed or old downloads to the Archive to keep your main view clean. Restore or permanently delete them from the archive section in the sidebar."
            />
          </div>
        </section>

        {/* About */}
        <section>
          <SectionHeader title="About" />
          <div
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ backgroundColor: "var(--surface-container-low)" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-body-sm"
                style={{ color: "var(--on-surface)" }}
              >
                Next DM
              </span>
              <span
                className="text-mono-sm"
                style={{ color: "var(--on-surface-variant)", fontSize: "0.65rem" }}
              >
                v0.1.0
              </span>
            </div>
            <span
              className="text-body-sm"
              style={{ color: "var(--on-surface-variant)" }}
            >
              A modern, multi-threaded download manager built with Tauri and React.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-body-sm" style={{ color: "var(--on-surface-variant)" }}>
        {description}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {keys.map((key, i) => (
          <span key={i}>
            {i > 0 && (
              <span
                className="text-mono-sm mx-0.5"
                style={{ color: "var(--on-surface-variant)", opacity: 0.3 }}
              >
                +
              </span>
            )}
            <kbd
              className="inline-block rounded px-1.5 py-0.5 text-mono-sm"
              style={{
                backgroundColor: "var(--surface-container)",
                color: "var(--on-surface)",
                fontSize: "0.65rem",
                border: "1px solid color-mix(in srgb, var(--outline) 20%, transparent)",
              }}
            >
              {key}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <span
        className="text-body-sm font-medium block mb-0.5"
        style={{ color: "var(--on-surface)" }}
      >
        {title}
      </span>
      <span
        className="text-body-sm"
        style={{ color: "var(--on-surface-variant)", lineHeight: 1.5 }}
      >
        {text}
      </span>
    </div>
  );
}
