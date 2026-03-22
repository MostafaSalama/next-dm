import { memo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import type { Task } from "../../stores/tasksStore";
import { useTasksStore } from "../../stores/tasksStore";
import { FileIcon } from "../../lib/fileIcons";
import { formatBytes, formatSpeed, formatEta } from "../../lib/formatters";

interface TaskRowProps {
  task: Task;
  style?: React.CSSProperties;
}

const STATUS_COLOR: Record<string, string> = {
  downloading: "var(--color-downloading)",
  completed: "var(--color-completed)",
  queued: "var(--color-queued)",
  paused: "var(--color-paused)",
  error: "var(--color-error)",
  pending: "var(--color-pending)",
};

const STATUS_LABEL: Record<string, string> = {
  downloading: "Downloading",
  completed: "Done",
  queued: "Queued",
  paused: "Paused",
  error: "Error",
  pending: "Pending",
};

export const TaskRow = memo(function TaskRow({ task, style }: TaskRowProps) {
  const isSelected = useTasksStore((s) => s.selectedIds.has(task.id));
  const toggleSelected = useTasksStore((s) => s.toggleSelected);

  const percent =
    task.totalBytes > 0
      ? Math.min(100, Math.round((task.downloadedBytes / task.totalBytes) * 100))
      : 0;

  const color = STATUS_COLOR[task.status] ?? "var(--on-surface-variant)";
  const label = STATUS_LABEL[task.status] ?? task.status;

  const handlePause = useCallback(
    () => invoke("pause_tasks", { ids: [task.id] }),
    [task.id],
  );
  const handleResume = useCallback(
    () => invoke("resume_tasks", { ids: [task.id] }),
    [task.id],
  );
  const handleCancel = useCallback(
    () => invoke("cancel_tasks", { ids: [task.id] }),
    [task.id],
  );
  const handleOpenFolder = useCallback(() => {
    if (task.savePath) {
      open(task.savePath).catch(() => {});
    }
  }, [task.savePath]);

  return (
    <div
      className="group animate-fade-in rounded-xl px-4 py-3 transition-colors duration-100"
      style={{
        ...style,
        backgroundColor: isSelected
          ? "color-mix(in srgb, var(--primary-fixed-dim) 8%, var(--surface-container-highest))"
          : "var(--surface-container-highest)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Selection checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleSelected(task.id);
          }}
          className="flex items-center justify-center rounded transition-all duration-100"
          style={{
            width: 18,
            height: 18,
            flexShrink: 0,
            border: isSelected
              ? "none"
              : "1.5px solid color-mix(in srgb, var(--on-surface-variant) 30%, transparent)",
            backgroundColor: isSelected
              ? "var(--primary-fixed-dim)"
              : "transparent",
            opacity: isSelected ? 1 : 0,
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.opacity = "0";
          }}
        >
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--on-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* File icon */}
        <FileIcon filename={task.filename} />

        {/* Filename + URL */}
        <div className="flex flex-col flex-1 min-w-0">
          <span
            className="text-body-md truncate"
            style={{ color: "var(--on-surface)" }}
          >
            {task.filename}
          </span>
          <span
            className="text-mono-sm truncate mt-0.5"
            style={{ color: "var(--on-surface-variant)", opacity: 0.5 }}
          >
            {task.url}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 shrink-0">
          {task.status === "downloading" && (
            <>
              <span className="text-mono-sm" style={{ color: "var(--primary-fixed-dim)" }}>
                {formatSpeed(task.speedBps)}
              </span>
              <span className="text-mono-sm" style={{ color: "var(--on-surface-variant)", opacity: 0.6 }}>
                {formatEta(task.etaSeconds)}
              </span>
            </>
          )}

          <span className="text-mono-sm" style={{ color: "var(--on-surface-variant)" }}>
            {task.totalBytes > 0
              ? `${formatBytes(task.downloadedBytes)} / ${formatBytes(task.totalBytes)}`
              : task.downloadedBytes > 0
                ? formatBytes(task.downloadedBytes)
                : "—"}
          </span>

          {/* Status badge */}
          <span className="status-badge" style={{ color }}>
            <span
              className={`status-dot ${task.status === "downloading" ? "animate-pulse-glow" : ""}`}
            />
            {label}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
            {task.status === "completed" && (
              <ActionButton label="Open Folder" onClick={handleOpenFolder}>
                <FolderOpenIcon />
              </ActionButton>
            )}
            {task.status === "downloading" && (
              <ActionButton label="Pause" onClick={handlePause}>
                <PauseIcon />
              </ActionButton>
            )}
            {(task.status === "paused" || task.status === "error") && (
              <ActionButton label={task.status === "error" ? "Retry" : "Resume"} onClick={handleResume}>
                <PlayIcon />
              </ActionButton>
            )}
            {(task.status === "downloading" || task.status === "queued" || task.status === "paused") && (
              <ActionButton label="Cancel" onClick={handleCancel} danger>
                <CancelIcon />
              </ActionButton>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {task.totalBytes > 0 && (
        <div className="mt-2 ml-[42px]">
          <div
            className="w-full rounded-full overflow-hidden"
            style={{
              height: 3,
              backgroundColor: "var(--surface-container)",
            }}
          >
            {task.status === "completed" ? (
              <div
                className="h-full rounded-full"
                style={{
                  width: "100%",
                  backgroundColor: "var(--primary-fixed)",
                }}
              />
            ) : (
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${
                  task.status === "downloading" ? "progress-shimmer" : ""
                }`}
                style={{
                  width: `${percent}%`,
                  ...(task.status !== "downloading" && {
                    background: `linear-gradient(90deg, var(--on-primary-container), var(--primary-fixed-dim))`,
                  }),
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {task.errorMessage && (
        <div className="text-body-sm mt-1.5 ml-[42px]" style={{ color: "var(--error)" }}>
          {task.errorMessage}
        </div>
      )}
    </div>
  );
});

function ActionButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={label}
      className="flex items-center justify-center rounded-md transition-colors duration-100"
      style={{
        width: 26,
        height: 26,
        color: danger ? "var(--error)" : "var(--on-surface-variant)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--surface-container)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      {children}
    </button>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}
