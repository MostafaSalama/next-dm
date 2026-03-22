import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useQueuesStore } from "../../stores/queuesStore";
import { useTasksStore, type Task } from "../../stores/tasksStore";
import { useSettingsStore } from "../../stores/settingsStore";

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 8000;

interface ToastData {
  id: string;
  url: string;
  filename: string | null;
  size: number;
  createdAt: number;
}

interface FileInfo {
  url: string;
  filename: string;
  size: number;
  supportsRange: boolean;
}

interface ClipboardToastProps {
  onAddToQueue: (urls: string[]) => void;
}

export function ClipboardToast({ onAddToQueue }: ClipboardToastProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const queues = useQueuesStore((s) => s.queues);
  const tasks = useTasksStore((s) => s.tasks);
  const setTasks = useTasksStore((s) => s.setTasks);
  const toastIdRef = useRef(0);

  const autoAddUrl = useCallback(
    async (url: string) => {
      const currentQueues = useQueuesStore.getState().queues;
      const queueId = currentQueues[0]?.id ?? "default";
      const savePath = currentQueues[0]?.savePath ?? "";
      try {
        const infos = await invoke<FileInfo[]>("preflight_check", { urls: [url] });
        const info = infos[0];
        if (!info) return;
        const ids = await invoke<string[]>("create_tasks", {
          input: [{
            url: info.url,
            filename: info.filename,
            originalName: info.filename,
            savePath,
            totalBytes: info.size,
            supportsRange: info.supportsRange,
            queueId,
            tags: [],
            config: {},
          }],
        });
        if (ids.length > 0) {
          const currentTasks = useTasksStore.getState().tasks;
          const newTask: Task = {
            id: ids[0], url: info.url, filename: info.filename,
            originalName: info.filename, savePath, status: "queued",
            totalBytes: info.size, downloadedBytes: 0, speedBps: 0,
            etaSeconds: 0, queueId, priority: 0, tags: [],
            errorMessage: null, chunks: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          };
          useTasksStore.getState().setTasks([...currentTasks, newTask]);
        }
      } catch (e) {
        console.error("Auto-add clipboard failed:", e);
      }
    },
    [],
  );

  useEffect(() => {
    const unlisten = listen<{ url: string }>("clipboard_url_detected", (event) => {
      const { url } = event.payload;
      const autoAdd = useSettingsStore.getState().settings.clipboardAutoAdd;

      if (autoAdd) {
        autoAddUrl(url);
        return;
      }

      toastIdRef.current += 1;
      const id = `toast-${toastIdRef.current}`;
      const toast: ToastData = {
        id,
        url,
        filename: null,
        size: 0,
        createdAt: Date.now(),
      };
      setToasts((prev) => [toast, ...prev]);

      invoke<FileInfo[]>("preflight_check", { urls: [url] })
        .then((infos) => {
          if (infos[0]) {
            setToasts((prev) =>
              prev.map((t) =>
                t.id === id
                  ? { ...t, filename: infos[0].filename, size: infos[0].size }
                  : t,
              ),
            );
          }
        })
        .catch(() => {});
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [autoAddUrl]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.createdAt < AUTO_DISMISS_MS));
    }, 500);
    return () => clearInterval(timer);
  }, [toasts.length > 0]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleDownloadNow = useCallback(
    async (toast: ToastData) => {
      dismiss(toast.id);
      const queueId = queues[0]?.id ?? "default";
      const savePath = queues[0]?.savePath ?? "";

      try {
        const infos = await invoke<FileInfo[]>("preflight_check", {
          urls: [toast.url],
        });
        const info = infos[0];
        if (!info) return;

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
          const newTask: Task = {
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
          };
          setTasks([...tasks, newTask]);
        }
      } catch (e) {
        console.error("Quick download failed:", e);
      }
    },
    [queues, tasks, setTasks, dismiss],
  );

  const handleAddToQueue = useCallback(
    (toast: ToastData) => {
      dismiss(toast.id);
      onAddToQueue([toast.url]);
    },
    [dismiss, onAddToQueue],
  );

  const visible = toasts.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, toasts.length - MAX_VISIBLE);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-50 flex flex-col gap-2"
      style={{ bottom: 16, right: 16, width: 360 }}
    >
      {visible.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={() => dismiss(toast.id)}
          onAddToQueue={() => handleAddToQueue(toast)}
          onDownloadNow={() => handleDownloadNow(toast)}
        />
      ))}
      {hiddenCount > 0 && (
        <div
          className="text-center text-body-sm rounded-lg py-1"
          style={{
            backgroundColor: "color-mix(in srgb, var(--surface-container-highest) 80%, transparent)",
            color: "var(--on-surface-variant)",
            fontSize: "0.65rem",
          }}
        >
          +{hiddenCount} more
        </div>
      )}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
  onAddToQueue,
  onDownloadNow,
}: {
  toast: ToastData;
  onDismiss: () => void;
  onAddToQueue: () => void;
  onDownloadNow: () => void;
}) {
  const elapsed = Date.now() - toast.createdAt;
  const progress = Math.max(0, 1 - elapsed / AUTO_DISMISS_MS);

  const truncatedUrl =
    toast.url.length > 50 ? toast.url.slice(0, 47) + "..." : toast.url;

  const sizeStr =
    toast.size > 0
      ? toast.size > 1048576
        ? `${(toast.size / 1048576).toFixed(1)} MB`
        : `${(toast.size / 1024).toFixed(1)} KB`
      : null;

  return (
    <div
      className="glass rounded-xl overflow-hidden"
      style={{
        animation: "fade-in 300ms ease-out",
      }}
    >
      <div className="px-4 py-3 relative">
        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 rounded p-0.5 transition-colors duration-100"
          style={{ color: "var(--on-surface-variant)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--surface-container)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2L8 8M8 2L2 8" />
          </svg>
        </button>

        {/* URL */}
        <div
          className="text-mono-sm truncate pr-5"
          style={{ color: "var(--on-surface)", fontSize: "0.65rem" }}
        >
          {truncatedUrl}
        </div>

        {/* Filename + size */}
        {(toast.filename || sizeStr) && (
          <div className="flex items-center gap-1.5 mt-1">
            {toast.filename && (
              <span className="text-body-sm truncate" style={{ color: "var(--on-surface)" }}>
                {toast.filename}
              </span>
            )}
            {sizeStr && (
              <span
                className="text-mono-sm"
                style={{ color: "var(--on-surface-variant)", fontSize: "0.6rem" }}
              >
                {sizeStr}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={onAddToQueue}
            className="rounded-lg px-3 py-1 text-body-sm transition-colors duration-100"
            style={{
              backgroundColor: "color-mix(in srgb, var(--primary-fixed-dim) 15%, transparent)",
              color: "var(--primary-fixed-dim)",
              fontSize: "0.7rem",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--primary-fixed-dim) 25%, transparent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--primary-fixed-dim) 15%, transparent)")
            }
          >
            Add to Queue
          </button>
          <button
            onClick={onDownloadNow}
            className="rounded-lg px-3 py-1 text-body-sm font-semibold transition-colors duration-100"
            style={{
              backgroundColor: "var(--primary-fixed)",
              color: "var(--on-primary)",
              fontSize: "0.7rem",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--primary-fixed-dim)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--primary-fixed)")
            }
          >
            Download Now
          </button>
        </div>
      </div>

      {/* Auto-dismiss progress line */}
      <div
        style={{
          height: 2,
          backgroundColor: "var(--primary-fixed-dim)",
          width: `${progress * 100}%`,
          transition: "width 500ms linear",
        }}
      />
    </div>
  );
}
