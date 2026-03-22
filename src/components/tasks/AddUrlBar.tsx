import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTasksStore } from "../../stores/tasksStore";
import { useQueuesStore } from "../../stores/queuesStore";

interface FileInfo {
  url: string;
  filename: string;
  size: number;
  supportsRange: boolean;
}

export function AddUrlBar() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const queues = useQueuesStore((s) => s.queues);
  const tasks = useTasksStore((s) => s.tasks);
  const setTasks = useTasksStore((s) => s.setTasks);

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
    <div
      className="flex items-center gap-2 px-5 pt-3 pb-1"
      style={{ flexShrink: 0 }}
    >
      <div className="relative flex-1">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--on-surface-variant)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ opacity: 0.4 }}
        >
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleDownload()}
          placeholder="Paste a URL to download..."
          className="w-full rounded-lg pl-9 pr-4 py-2 text-body-sm outline-none transition-all duration-150"
          style={{
            backgroundColor: "var(--surface-container)",
            color: "var(--on-surface)",
            border: "1px solid transparent",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor =
              "color-mix(in srgb, var(--primary-fixed-dim) 30%, transparent)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "transparent")
          }
        />
      </div>
      <button
        onClick={handleDownload}
        disabled={loading || !url.trim()}
        className="rounded-lg px-4 py-2 text-body-sm font-semibold transition-all duration-150"
        style={{
          backgroundColor: "var(--primary-fixed)",
          color: "var(--on-primary)",
          opacity: loading || !url.trim() ? 0.4 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading && url.trim())
            e.currentTarget.style.backgroundColor = "var(--primary-fixed-dim)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--primary-fixed)";
        }}
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
              <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
            </svg>
            Checking
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
            Download
          </span>
        )}
      </button>
    </div>
  );
}
