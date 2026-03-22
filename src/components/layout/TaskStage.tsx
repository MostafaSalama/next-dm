import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTasksStore, type TaskStatus } from "../../stores/tasksStore";
import { useQueuesStore } from "../../stores/queuesStore";
import { formatBytes, formatSpeed, formatEta } from "../../lib/formatters";

const FILTER_TABS: { label: string; value: TaskStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Downloading", value: "downloading" },
  { label: "Queued", value: "queued" },
  { label: "Completed", value: "completed" },
  { label: "Errored", value: "error" },
];

interface FileInfo {
  url: string;
  filename: string;
  size: number;
  supportsRange: boolean;
}

export function TaskStage() {
  const filterStatus = useTasksStore((s) => s.filterStatus);
  const setFilterStatus = useTasksStore((s) => s.setFilterStatus);
  const filteredTasks = useTasksStore((s) => s.filteredTasks)();
  const selectedIds = useTasksStore((s) => s.selectedIds);

  return (
    <main
      className="flex flex-col flex-1 h-full overflow-hidden"
      style={{ backgroundColor: "var(--surface-container-high)" }}
    >
      {/* Filter Bar */}
      <div
        className="flex items-center gap-1 px-6 pt-4 pb-2"
        style={{ flexShrink: 0 }}
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className="rounded-lg px-3 py-1.5 text-label-md transition-colors duration-150"
            style={{
              backgroundColor:
                filterStatus === tab.value
                  ? "var(--surface-container-highest)"
                  : "transparent",
              color:
                filterStatus === tab.value
                  ? "var(--on-surface)"
                  : "var(--on-surface-variant)",
            }}
            onMouseEnter={(e) => {
              if (filterStatus !== tab.value)
                e.currentTarget.style.backgroundColor =
                  "var(--surface-container)";
            }}
            onMouseLeave={(e) => {
              if (filterStatus !== tab.value)
                e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-6 py-2 text-body-sm"
          style={{
            backgroundColor: "var(--surface-container-highest)",
            color: "var(--on-surface)",
          }}
        >
          <span>{selectedIds.size} selected</span>
          <BulkButton
            label="Pause All"
            color="var(--primary-fixed-dim)"
            onClick={() =>
              invoke("pause_tasks", { ids: [...selectedIds] })
            }
          />
          <BulkButton
            label="Resume All"
            color="var(--primary-fixed-dim)"
            onClick={() =>
              invoke("resume_tasks", { ids: [...selectedIds] })
            }
          />
          <BulkButton
            label="Cancel All"
            color="var(--error)"
            onClick={() =>
              invoke("cancel_tasks", { ids: [...selectedIds] })
            }
          />
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {filteredTasks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function BulkButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-label-md px-2 py-1 rounded transition-colors duration-150"
      style={{ color }}
    >
      {label}
    </button>
  );
}

function EmptyState() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const queues = useQueuesStore((s) => s.queues);
  const setTasks = useTasksStore((s) => s.setTasks);
  const tasks = useTasksStore((s) => s.tasks);

  const handleDownload = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const infos = await invoke<FileInfo[]>("preflight_check", {
        urls: [trimmed],
      });
      const info = infos[0];
      if (!info) return;

      const queueId = queues[0]?.id ?? "default";
      const savePath = queues[0]?.savePath ?? "";

      const ids = await invoke<string[]>("create_tasks", {
        input: [
          {
            url: info.url,
            filename: info.filename,
            originalName: info.filename,
            savePath,
            totalBytes: info.size,
            supportsRange: info.supportsRange,
            queueId,
            tags: [],
            config: {},
          },
        ],
      });

      if (ids.length > 0) {
        setTasks([
          ...tasks,
          {
            id: ids[0],
            url: info.url,
            filename: info.filename,
            originalName: info.filename,
            savePath,
            status: "queued",
            totalBytes: info.size,
            downloadedBytes: 0,
            speedBps: 0,
            etaSeconds: 0,
            queueId,
            priority: 0,
            tags: [],
            errorMessage: null,
            chunks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
        setUrl("");
      }
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div
        className="text-display-sm font-display"
        style={{ color: "var(--on-surface-variant)", opacity: 0.5 }}
      >
        No Downloads
      </div>
      <div
        className="text-body-md text-center max-w-sm"
        style={{ color: "var(--on-surface-variant)", opacity: 0.4 }}
      >
        Paste a URL below to start downloading.
      </div>
      <div className="flex gap-2 w-full max-w-lg mt-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleDownload()}
          placeholder="https://example.com/file.zip"
          className="flex-1 rounded-lg px-4 py-2.5 text-mono-md outline-none transition-all duration-150"
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            color: "var(--on-surface)",
            border: "1px solid color-mix(in srgb, var(--outline-variant) 12%, transparent)",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor =
              "color-mix(in srgb, var(--primary-fixed-dim) 40%, transparent)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor =
              "color-mix(in srgb, var(--outline-variant) 12%, transparent)")
          }
        />
        <button
          onClick={handleDownload}
          disabled={loading || !url.trim()}
          className="rounded-lg px-5 py-2.5 text-body-md font-semibold transition-colors duration-150"
          style={{
            backgroundColor: "var(--primary-fixed)",
            color: "var(--on-primary)",
            opacity: loading || !url.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "Checking..." : "Download"}
        </button>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: ReturnType<typeof useTasksStore.getState>["tasks"][0] }) {
  const percent =
    task.totalBytes > 0
      ? Math.round((task.downloadedBytes / task.totalBytes) * 100)
      : 0;

  const statusColor: Record<string, string> = {
    downloading: "var(--color-downloading)",
    completed: "var(--color-completed)",
    queued: "var(--color-queued)",
    paused: "var(--color-paused)",
    error: "var(--color-error)",
    pending: "var(--color-pending)",
  };

  return (
    <div
      className="rounded-xl px-4 py-3 transition-colors duration-150"
      style={{ backgroundColor: "var(--surface-container-highest)" }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-body-md truncate flex-1 mr-4"
          style={{ color: "var(--on-surface)" }}
        >
          {task.filename}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {task.status === "downloading" && (
            <>
              <span className="text-body-sm" style={{ color: "var(--on-surface-variant)" }}>
                {formatSpeed(task.speedBps)}
              </span>
              <span className="text-body-sm" style={{ color: "var(--on-surface-variant)" }}>
                {formatEta(task.etaSeconds)}
              </span>
            </>
          )}
          <span className="text-body-sm" style={{ color: "var(--on-surface-variant)" }}>
            {task.totalBytes > 0
              ? `${formatBytes(task.downloadedBytes)} / ${formatBytes(task.totalBytes)}`
              : formatBytes(task.downloadedBytes)}
          </span>
          <span
            className="text-label-md px-2 py-0.5 rounded"
            style={{
              color: statusColor[task.status] ?? "var(--on-surface-variant)",
            }}
          >
            {task.status}
          </span>
          {task.status === "downloading" && (
            <button
              onClick={() => invoke("pause_tasks", { ids: [task.id] })}
              className="text-label-md px-2 py-0.5 rounded transition-colors"
              style={{ color: "var(--on-surface-variant)" }}
            >
              Pause
            </button>
          )}
          {task.status === "paused" && (
            <button
              onClick={() => invoke("resume_tasks", { ids: [task.id] })}
              className="text-label-md px-2 py-0.5 rounded transition-colors"
              style={{ color: "var(--primary-fixed-dim)" }}
            >
              Resume
            </button>
          )}
          {(task.status === "error") && (
            <button
              onClick={() => invoke("resume_tasks", { ids: [task.id] })}
              className="text-label-md px-2 py-0.5 rounded transition-colors"
              style={{ color: "var(--primary-fixed-dim)" }}
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {task.totalBytes > 0 && task.status !== "completed" && (
        <div
          className="w-full rounded-full overflow-hidden"
          style={{
            height: 4,
            backgroundColor: "var(--surface-container)",
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${percent}%`,
              background: `linear-gradient(90deg, var(--on-primary-container), var(--primary-fixed-dim))`,
            }}
          />
        </div>
      )}
      {task.status === "completed" && (
        <div
          className="w-full rounded-full"
          style={{
            height: 4,
            backgroundColor: "var(--primary-fixed)",
          }}
        />
      )}

      {task.errorMessage && (
        <div className="text-body-sm mt-1" style={{ color: "var(--error)" }}>
          {task.errorMessage}
        </div>
      )}
    </div>
  );
}
