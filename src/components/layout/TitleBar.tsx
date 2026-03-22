import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export function TitleBar() {
  return (
    <header
      className="drag-region flex items-center justify-between px-4"
      style={{
        height: 40,
        backgroundColor: "var(--surface)",
        borderBottom: "1px solid color-mix(in srgb, var(--outline-variant) 12%, transparent)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="font-display text-[0.85rem] font-bold tracking-tight"
          style={{ color: "var(--primary-fixed)" }}
        >
          Next DM
        </span>
        <span
          className="text-label-sm"
          style={{ color: "var(--on-surface-variant)" }}
        >
          v0.1.0
        </span>
      </div>

      <div className="no-drag flex items-center gap-1">
        <WindowButton label="—" onClick={() => appWindow.minimize()} />
        <WindowButton label="□" onClick={() => appWindow.toggleMaximize()} />
        <WindowButton label="✕" onClick={() => appWindow.close()} isClose />
      </div>
    </header>
  );
}

function WindowButton({
  label,
  onClick,
  isClose,
}: {
  label: string;
  onClick: () => void;
  isClose?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-sm text-xs transition-colors duration-150"
      style={{
        width: 32,
        height: 28,
        color: "var(--on-surface-variant)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = isClose
          ? "#c42b1c"
          : "var(--surface-container-high)";
        if (isClose) e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = "var(--on-surface-variant)";
      }}
    >
      {label}
    </button>
  );
}
