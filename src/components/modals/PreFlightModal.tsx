import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQueuesStore } from "../../stores/queuesStore";
import { useTasksStore, type Task } from "../../stores/tasksStore";
import { formatBytes } from "../../lib/formatters";
import {
  resolveAllFiles,
  type IndexConfig,
  type FileEntry,
} from "../../lib/naming";
import { PatternInput } from "../shared/PatternInput";
import { TagInput } from "../shared/TagInput";
import { FolderPicker } from "../shared/FolderPicker";

interface FileInfo {
  url: string;
  filename: string;
  size: number;
  supportsRange: boolean;
}

type ResolveStatus = "pending" | "resolving" | "resolved" | "error";

interface UrlEntry {
  url: string;
  info: FileInfo | null;
  status: ResolveStatus;
  selected: boolean;
}

interface PreFlightModalProps {
  urls: string[];
  onClose: () => void;
}

export function PreFlightModal({ urls: initialUrls, onClose }: PreFlightModalProps) {
  const queues = useQueuesStore((s) => s.queues);
  const tasks = useTasksStore((s) => s.tasks);
  const setTasks = useTasksStore((s) => s.setTasks);

  const [entries, setEntries] = useState<UrlEntry[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [pattern, setPattern] = useState("{original}{ext}");
  const [indexConfig, setIndexConfig] = useState<IndexConfig>({
    start: 1,
    step: 1,
    padding: 2,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [savePath, setSavePath] = useState(queues[0]?.savePath ?? "");
  const [queueId, setQueueId] = useState(queues[0]?.id ?? "");
  const [showMetadata, setShowMetadata] = useState(false);
  const [headers, setHeaders] = useState("");
  const [referer, setReferer] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resolveUrls = useCallback(
    async (urlsToResolve: string[]) => {
      if (urlsToResolve.length === 0) return;

      setEntries((prev) => {
        const existing = new Set(prev.map((e) => e.url));
        const newEntries = urlsToResolve
          .filter((u) => !existing.has(u))
          .map((url) => ({
            url,
            info: null,
            status: "resolving" as ResolveStatus,
            selected: true,
          }));
        return [...prev, ...newEntries];
      });

      try {
        const infos = await invoke<FileInfo[]>("preflight_check", {
          urls: urlsToResolve,
        });
        setEntries((prev) =>
          prev.map((entry) => {
            const info = infos.find((i) => i.url === entry.url);
            if (info) {
              return { ...entry, info, status: "resolved" };
            }
            return entry;
          }),
        );
      } catch {
        setEntries((prev) =>
          prev.map((entry) =>
            urlsToResolve.includes(entry.url)
              ? { ...entry, status: "error" }
              : entry,
          ),
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (initialUrls.length > 0) {
      resolveUrls(initialUrls);
    }
  }, []);

  const handleAddUrls = () => {
    const newUrls = urlInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && /^https?:\/\//.test(u));
    if (newUrls.length > 0) {
      resolveUrls(newUrls);
      setUrlInput("");
    }
  };

  const toggleEntry = (url: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.url === url ? { ...e, selected: !e.selected } : e,
      ),
    );
  };

  const removeEntry = (url: string) => {
    setEntries((prev) => prev.filter((e) => e.url !== url));
  };

  const toggleAll = () => {
    const allSelected = entries.every((e) => e.selected);
    setEntries((prev) => prev.map((e) => ({ ...e, selected: !allSelected })));
  };

  const selectedEntries = entries.filter((e) => e.selected && e.info);
  const queueName = queues.find((q) => q.id === queueId)?.name ?? "Default";

  const previewNames = useMemo(() => {
    const files: FileEntry[] = selectedEntries.map((e) => ({
      filename: e.info!.filename,
      tags,
    }));
    return resolveAllFiles(pattern, files, queueName, indexConfig);
  }, [selectedEntries.length, pattern, indexConfig, tags, queueName]);

  const createTasks = async (_startImmediately: boolean) => {
    if (selectedEntries.length === 0) return;
    setSubmitting(true);

    const configObj: Record<string, string> = {};
    if (headers.trim()) configObj.headers = headers.trim();
    if (referer.trim()) configObj.referer = referer.trim();
    if (userAgent.trim()) configObj.userAgent = userAgent.trim();

    const taskInputs = selectedEntries.map((entry, i) => ({
      url: entry.info!.url,
      filename: previewNames[i] || entry.info!.filename,
      originalName: entry.info!.filename,
      savePath: savePath || queues.find((q) => q.id === queueId)?.savePath || "",
      totalBytes: entry.info!.size,
      supportsRange: entry.info!.supportsRange,
      queueId,
      tags,
      config: configObj,
    }));

    try {
      const ids = await invoke<string[]>("create_tasks", { input: taskInputs });

      const newTasks: Task[] = ids.map((id, i) => ({
        id,
        url: taskInputs[i].url,
        filename: taskInputs[i].filename,
        originalName: taskInputs[i].originalName,
        savePath: taskInputs[i].savePath,
        status: "queued" as const,
        totalBytes: taskInputs[i].totalBytes,
        downloadedBytes: 0,
        speedBps: 0,
        etaSeconds: 0,
        queueId: taskInputs[i].queueId,
        priority: 0,
        tags: taskInputs[i].tags,
        errorMessage: null,
        isArchived: false,
        chunks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      setTasks([...tasks, ...newTasks]);
      onClose();
    } catch (e) {
      console.error("Failed to create tasks:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--surface-container-low)",
          width: "min(90vw, 900px)",
          height: "min(85vh, 640px)",
          boxShadow: "0 16px 64px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{
            backgroundColor: "var(--surface-container)",
            flexShrink: 0,
          }}
        >
          <span className="text-title-sm font-display" style={{ color: "var(--on-surface)" }}>
            Pre-Flight
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors duration-100"
            style={{ color: "var(--on-surface-variant)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--surface-container-high)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4L12 12M12 4L4 12" />
            </svg>
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: URL list */}
          <div
            className="flex flex-col"
            style={{
              width: "50%",
              borderRight: "1px solid color-mix(in srgb, var(--outline) 15%, transparent)",
            }}
          >
            {/* URL input area */}
            <div className="px-4 pt-3 pb-2" style={{ flexShrink: 0 }}>
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    e.preventDefault();
                    handleAddUrls();
                  }
                }}
                placeholder="Paste URLs here (one per line)..."
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-body-sm outline-none resize-none font-mono"
                style={{
                  backgroundColor: "var(--surface-container)",
                  color: "var(--on-surface)",
                  border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
                  fontSize: "0.7rem",
                }}
              />
              <button
                onClick={handleAddUrls}
                className="mt-1 rounded-lg px-3 py-1 text-body-sm transition-colors duration-100"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--primary-fixed-dim) 15%, transparent)",
                  color: "var(--primary-fixed-dim)",
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
                Add URLs (Ctrl+Enter)
              </button>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              {entries.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={toggleAll}
                    className="text-body-sm"
                    style={{ color: "var(--primary-fixed-dim)", fontSize: "0.65rem" }}
                  >
                    {entries.every((e) => e.selected) ? "Deselect all" : "Select all"}
                  </button>
                  <span className="text-body-sm" style={{ color: "var(--on-surface-variant)", opacity: 0.5, fontSize: "0.65rem" }}>
                    {selectedEntries.length} of {entries.length} selected
                  </span>
                </div>
              )}

              {entries.map((entry) => (
                <div
                  key={entry.url}
                  className="flex items-start gap-2 py-2 group"
                  style={{
                    borderBottom: "1px solid color-mix(in srgb, var(--outline) 8%, transparent)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={entry.selected}
                    onChange={() => toggleEntry(entry.url)}
                    className="mt-1 accent-[var(--primary-fixed-dim)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {entry.status === "resolving" && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary-fixed-dim)" strokeWidth="2.5" className="animate-spin" style={{ flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
                        </svg>
                      )}
                      {entry.status === "resolved" && (
                        <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
                          <circle cx="6" cy="6" r="5" fill="var(--color-completed)" opacity="0.3" />
                          <path d="M3.5 6L5.5 8L8.5 4" stroke="var(--color-completed)" strokeWidth="1.5" fill="none" />
                        </svg>
                      )}
                      {entry.status === "error" && (
                        <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
                          <circle cx="6" cy="6" r="5" fill="var(--error)" opacity="0.3" />
                          <path d="M4 4L8 8M8 4L4 8" stroke="var(--error)" strokeWidth="1.5" />
                        </svg>
                      )}
                      <span
                        className="text-body-sm truncate font-medium"
                        style={{ color: "var(--on-surface)" }}
                      >
                        {entry.info?.filename ?? "Resolving..."}
                      </span>
                    </div>
                    <div
                      className="text-mono-sm truncate mt-0.5"
                      style={{ color: "var(--on-surface-variant)", opacity: 0.5, fontSize: "0.6rem" }}
                    >
                      {entry.url}
                    </div>
                    {entry.info && entry.info.size > 0 && (
                      <span
                        className="text-mono-sm"
                        style={{ color: "var(--on-surface-variant)", fontSize: "0.6rem" }}
                      >
                        {formatBytes(entry.info.size)}
                        {entry.info.supportsRange && " • Resumable"}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeEntry(entry.url)}
                    className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-0.5"
                    style={{ color: "var(--on-surface-variant)" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 2L8 8M8 2L2 8" />
                    </svg>
                  </button>
                </div>
              ))}

              {entries.length === 0 && (
                <div
                  className="text-center py-8 text-body-sm"
                  style={{ color: "var(--on-surface-variant)", opacity: 0.3 }}
                >
                  Paste URLs above to get started
                </div>
              )}
            </div>
          </div>

          {/* Right: Configuration */}
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-3">
            <div className="flex flex-col gap-4">
              {/* File naming */}
              <Section title="File Naming">
                <PatternInput value={pattern} onChange={setPattern} />
                <div className="flex gap-3 mt-2">
                  <NumberField
                    label="Start"
                    value={indexConfig.start}
                    onChange={(v) => setIndexConfig({ ...indexConfig, start: v })}
                    min={0}
                  />
                  <NumberField
                    label="Padding"
                    value={indexConfig.padding}
                    onChange={(v) => setIndexConfig({ ...indexConfig, padding: v })}
                    min={1}
                    max={5}
                  />
                  <NumberField
                    label="Step"
                    value={indexConfig.step}
                    onChange={(v) => setIndexConfig({ ...indexConfig, step: v })}
                    min={1}
                  />
                </div>

                {/* Preview */}
                {previewNames.length > 0 && (
                  <div className="mt-2">
                    <span
                      className="text-label-md mb-1 block"
                      style={{ color: "var(--on-surface-variant)", fontSize: "0.6rem" }}
                    >
                      Preview
                    </span>
                    <div
                      className="rounded-lg p-2 max-h-[100px] overflow-y-auto"
                      style={{ backgroundColor: "var(--surface-container)" }}
                    >
                      {previewNames.map((name, i) => (
                        <div
                          key={i}
                          className="text-mono-sm py-0.5 flex gap-2"
                          style={{ fontSize: "0.6rem" }}
                        >
                          <span style={{ color: "var(--on-surface-variant)", opacity: 0.4 }}>
                            {selectedEntries[i]?.info?.filename}
                          </span>
                          <span style={{ color: "var(--on-surface-variant)", opacity: 0.3 }}>→</span>
                          <span style={{ color: "var(--primary-fixed-dim)" }}>{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* Tags */}
              <Section title="Tags">
                <TagInput tags={tags} onChange={setTags} />
              </Section>

              {/* Destination */}
              <Section title="Destination">
                <FolderPicker value={savePath} onChange={setSavePath} />
              </Section>

              {/* Queue */}
              <Section title="Queue">
                <select
                  value={queueId}
                  onChange={(e) => setQueueId(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-body-sm outline-none"
                  style={{
                    backgroundColor: "var(--surface-container)",
                    color: "var(--on-surface)",
                    border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
                  }}
                >
                  {queues.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </select>
              </Section>

              {/* Metadata */}
              <Section
                title="Metadata"
                collapsible
                collapsed={!showMetadata}
                onToggle={() => setShowMetadata(!showMetadata)}
              >
                <div className="flex flex-col gap-2">
                  <MetaField label="Custom Headers" value={headers} onChange={setHeaders} placeholder="Key: Value (one per line)" multiline />
                  <MetaField label="Referer" value={referer} onChange={setReferer} placeholder="https://example.com" />
                  <MetaField label="User-Agent" value={userAgent} onChange={setUserAgent} placeholder="Custom user agent string" />
                </div>
              </Section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{
            backgroundColor: "var(--surface-container)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-body-sm transition-colors duration-100"
            style={{ color: "var(--on-surface-variant)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--surface-container-high)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            Cancel
          </button>
          <button
            onClick={() => createTasks(false)}
            disabled={submitting || selectedEntries.length === 0}
            className="rounded-lg px-4 py-2 text-body-sm transition-colors duration-100"
            style={{
              color: "var(--primary-fixed-dim)",
              backgroundColor: "color-mix(in srgb, var(--primary-fixed-dim) 10%, transparent)",
              opacity: submitting || selectedEntries.length === 0 ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (!submitting && selectedEntries.length > 0)
                e.currentTarget.style.backgroundColor =
                  "color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--primary-fixed-dim) 10%, transparent)";
            }}
          >
            Add to Queue
          </button>
          <button
            onClick={() => createTasks(true)}
            disabled={submitting || selectedEntries.length === 0}
            className="rounded-lg px-4 py-2 text-body-sm font-semibold transition-colors duration-100"
            style={{
              backgroundColor: "var(--primary-fixed)",
              color: "var(--on-primary)",
              opacity: submitting || selectedEntries.length === 0 ? 0.4 : 1,
            }}
            onMouseEnter={(e) => {
              if (!submitting && selectedEntries.length > 0)
                e.currentTarget.style.backgroundColor = "var(--primary-fixed-dim)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--primary-fixed)";
            }}
          >
            {submitting ? "Creating..." : `Download Now (${selectedEntries.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  collapsible,
  collapsed,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1.5 mb-1.5"
        style={{ cursor: collapsible ? "pointer" : "default" }}
        onClick={onToggle}
      >
        {collapsible && (
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="var(--on-surface-variant)"
            style={{
              transform: collapsed ? "rotate(-90deg)" : "none",
              transition: "transform 100ms",
            }}
          >
            <path d="M1 2L4 6L7 2" />
          </svg>
        )}
        <span
          className="text-label-md"
          style={{ color: "var(--on-surface-variant)", fontSize: "0.7rem" }}
        >
          {title}
        </span>
      </div>
      {!collapsed && children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label-md" style={{ color: "var(--on-surface-variant)", fontSize: "0.6rem" }}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        min={min}
        max={max}
        className="w-16 rounded-lg px-2 py-1 text-body-sm text-center outline-none"
        style={{
          backgroundColor: "var(--surface-container)",
          color: "var(--on-surface)",
          border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
        }}
      />
    </div>
  );
}

function MetaField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const style = {
    backgroundColor: "var(--surface-container)",
    color: "var(--on-surface)",
    border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
  };

  return (
    <div>
      <span
        className="text-label-md block mb-0.5"
        style={{ color: "var(--on-surface-variant)", fontSize: "0.6rem" }}
      >
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-lg px-3 py-1.5 text-body-sm outline-none resize-none font-mono"
          style={{ ...style, fontSize: "0.65rem" }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg px-3 py-1.5 text-body-sm outline-none font-mono"
          style={{ ...style, fontSize: "0.65rem" }}
        />
      )}
    </div>
  );
}
