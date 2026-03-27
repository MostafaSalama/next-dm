import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQueuesStore } from "../../stores/queuesStore";
import { useTasksStore, type Task } from "../../stores/tasksStore";
import { FolderPicker } from "../shared/FolderPicker";
import { formatBytes } from "../../lib/formatters";
import {
  formatDuration,
  getPlatformLabel,
  detectPlatform,
} from "../../lib/platformDetect";

interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string | null;
  height: number | null;
  width: number | null;
  fps: number | null;
  vcodec: string | null;
  acodec: string | null;
  filesize: number | null;
  filesizeApprox: number | null;
  tbr: number | null;
  formatNote: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface SubtitleInfo {
  ext: string;
  name: string | null;
}

interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  description: string;
  uploader: string;
  uploadDate: string;
  platform: string;
  webpageUrl: string;
  formats: VideoFormat[];
  subtitles: Record<string, SubtitleInfo[]>;
  isLive: boolean;
  playlistId: string | null;
  playlistTitle: string | null;
  playlistCount: number | null;
}

interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  duration: number | null;
  thumbnail: string | null;
}

interface PlaylistInfo {
  id: string;
  title: string;
  uploader: string;
  entries: PlaylistEntry[];
  totalCount: number;
}

interface QualityPreset {
  label: string;
  formatSelector: string;
  description: string;
}

const QUALITY_PRESETS: QualityPreset[] = [
  {
    label: "Best",
    formatSelector: "bestvideo+bestaudio/best",
    description: "Highest available quality",
  },
  {
    label: "2160p (4K)",
    formatSelector: "bestvideo[height<=2160]+bestaudio/best[height<=2160]",
    description: "Ultra HD",
  },
  {
    label: "1080p",
    formatSelector: "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    description: "Full HD",
  },
  {
    label: "720p",
    formatSelector: "bestvideo[height<=720]+bestaudio/best[height<=720]",
    description: "HD",
  },
  {
    label: "480p",
    formatSelector: "bestvideo[height<=480]+bestaudio/best[height<=480]",
    description: "Standard",
  },
  {
    label: "360p",
    formatSelector: "bestvideo[height<=360]+bestaudio/best[height<=360]",
    description: "Low",
  },
  {
    label: "Audio Only",
    formatSelector: "bestaudio/best",
    description: "Audio only (no video)",
  },
];

const OUTPUT_FORMATS = ["mp4", "mkv", "webm", "mp3", "m4a"];

interface VideoPreFlightModalProps {
  urls: string[];
  onClose: () => void;
}

type ExtractState = "idle" | "extracting" | "done" | "error";

export function VideoPreFlightModal({
  urls,
  onClose,
}: VideoPreFlightModalProps) {
  const queues = useQueuesStore((s) => s.queues);
  const tasks = useTasksStore((s) => s.tasks);
  const setTasks = useTasksStore((s) => s.setTasks);

  const [extractState, setExtractState] = useState<ExtractState>("idle");
  const [error, setError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(
    new Set(),
  );

  const [qualityIndex, setQualityIndex] = useState(2); // 1080p default
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [selectedSubtitles, setSelectedSubtitles] = useState<Set<string>>(
    new Set(),
  );
  const [savePath, setSavePath] = useState(queues[0]?.savePath ?? "");
  const [queueId, setQueueId] = useState(queues[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  const url = urls[0] || "";
  const platform = detectPlatform(url);

  const extractInfo = useCallback(async () => {
    if (!url) return;
    setExtractState("extracting");
    setError("");

    try {
      if (platform.isPlaylist) {
        const pl = await invoke<PlaylistInfo>("video_extract_playlist", {
          url,
        });
        setPlaylistInfo(pl);
        setSelectedPlaylistIds(new Set(pl.entries.map((e) => e.id)));
        if (pl.entries.length > 0) {
          const firstUrl =
            pl.entries[0].url ||
            `https://www.youtube.com/watch?v=${pl.entries[0].id}`;
          try {
            const info = await invoke<VideoInfo>("video_extract_info", {
              url: firstUrl,
            });
            setVideoInfo(info);
          } catch {
            // format info from first video not critical for playlists
          }
        }
      } else {
        const info = await invoke<VideoInfo>("video_extract_info", { url });
        setVideoInfo(info);
        if (info.isLive) {
          setError(
            "This is a live stream. Downloads may not work as expected.",
          );
        }
      }
      setExtractState("done");
    } catch (e) {
      setError(String(e));
      setExtractState("error");
    }
  }, [url, platform.isPlaylist]);

  useEffect(() => {
    extractInfo();
  }, []);

  const togglePlaylistEntry = (id: string) => {
    setSelectedPlaylistIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPlaylist = () => {
    if (!playlistInfo) return;
    if (selectedPlaylistIds.size === playlistInfo.entries.length) {
      setSelectedPlaylistIds(new Set());
    } else {
      setSelectedPlaylistIds(
        new Set(playlistInfo.entries.map((e) => e.id)),
      );
    }
  };

  const toggleSubtitle = (lang: string) => {
    setSelectedSubtitles((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  };

  const createVideoTasks = async () => {
    setSubmitting(true);
    const preset = QUALITY_PRESETS[qualityIndex];

    try {
      if (playlistInfo && playlistInfo.entries.length > 0) {
        const selected = playlistInfo.entries.filter((e) =>
          selectedPlaylistIds.has(e.id),
        );
        if (selected.length === 0) {
          setSubmitting(false);
          return;
        }

        const taskInputs = selected.map((entry) => {
          const safeTitle = sanitizeFilename(entry.title || entry.id);
          const ext =
            preset.label === "Audio Only"
              ? outputFormat === "mp3" || outputFormat === "m4a"
                ? outputFormat
                : "m4a"
              : outputFormat;
          return {
            url:
              entry.url ||
              `https://www.youtube.com/watch?v=${entry.id}`,
            filename: `${safeTitle}.${ext}`,
            originalName: entry.title || entry.id,
            savePath:
              savePath || queues.find((q) => q.id === queueId)?.savePath || "",
            totalBytes: 0,
            supportsRange: false,
            queueId,
            tags: ["video", platform.platform || "unknown"],
            config: {
              task_type: "video",
              platform: platform.platform || "unknown",
              format_id: preset.formatSelector,
              output_format: outputFormat,
              subtitles: Array.from(selectedSubtitles),
              embed_subs: selectedSubtitles.size > 0,
              embed_thumbnail: false,
              thumbnail: entry.thumbnail || "",
              duration: entry.duration || 0,
              resolution: preset.label,
              playlist_title: playlistInfo.title,
            },
          };
        });

        const ids = await invoke<string[]>("create_tasks", {
          input: taskInputs,
        });

        const newTasks: Task[] = ids.map((id, i) => ({
          id,
          url: taskInputs[i].url,
          filename: taskInputs[i].filename,
          originalName: taskInputs[i].originalName,
          savePath: taskInputs[i].savePath,
          status: "queued" as const,
          totalBytes: 0,
          downloadedBytes: 0,
          speedBps: 0,
          etaSeconds: 0,
          queueId,
          priority: 0,
          tags: taskInputs[i].tags,
          errorMessage: null,
          isArchived: false,
          chunks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          videoMeta: {
            taskType: "video",
            platform: platform.platform || "unknown",
            thumbnail: selected[i]?.thumbnail || undefined,
            duration: selected[i]?.duration || undefined,
            resolution: preset.label,
            playlistTitle: playlistInfo.title,
          },
        }));

        setTasks([...tasks, ...newTasks]);
      } else if (videoInfo) {
        const safeTitle = sanitizeFilename(videoInfo.title);
        const ext =
          preset.label === "Audio Only"
            ? outputFormat === "mp3" || outputFormat === "m4a"
              ? outputFormat
              : "m4a"
            : outputFormat;

        const taskInputs = [
          {
            url: videoInfo.webpageUrl || url,
            filename: `${safeTitle}.${ext}`,
            originalName: videoInfo.title,
            savePath:
              savePath || queues.find((q) => q.id === queueId)?.savePath || "",
            totalBytes: estimateFileSize(videoInfo, qualityIndex),
            supportsRange: false,
            queueId,
            tags: ["video", platform.platform || "unknown"],
            config: {
              task_type: "video",
              platform: videoInfo.platform || platform.platform || "unknown",
              video_id: videoInfo.id,
              format_id: preset.formatSelector,
              output_format: outputFormat,
              subtitles: Array.from(selectedSubtitles),
              embed_subs: selectedSubtitles.size > 0,
              embed_thumbnail: false,
              thumbnail: videoInfo.thumbnail,
              duration: videoInfo.duration,
              resolution: preset.label,
            },
          },
        ];

        const ids = await invoke<string[]>("create_tasks", {
          input: taskInputs,
        });

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
          queueId,
          priority: 0,
          tags: taskInputs[i].tags,
          errorMessage: null,
          isArchived: false,
          chunks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          videoMeta: {
            taskType: "video",
            platform: videoInfo.platform || platform.platform || "unknown",
            videoId: videoInfo.id,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration,
            resolution: preset.label,
          },
        }));

        setTasks([...tasks, ...newTasks]);
      }

      onClose();
    } catch (e) {
      console.error("Failed to create video tasks:", e);
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const subtitleLangs = videoInfo
    ? Object.keys(videoInfo.subtitles)
    : [];

  const isReady =
    extractState === "done" &&
    (videoInfo !== null || (playlistInfo !== null && selectedPlaylistIds.size > 0));

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--surface-container-low)",
          width: "min(92vw, 720px)",
          height: "min(88vh, 680px)",
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
          <div className="flex items-center gap-2">
            <PlatformIcon platform={platform.platform} />
            <span
              className="text-title-sm font-display"
              style={{ color: "var(--on-surface)" }}
            >
              {playlistInfo
                ? "Playlist Download"
                : "Video Download"}
            </span>
            {platform.platform && (
              <span
                className="text-label-sm px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--primary-fixed-dim) 15%, transparent)",
                  color: "var(--primary-fixed-dim)",
                  fontSize: "0.6rem",
                }}
              >
                {getPlatformLabel(platform.platform)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors duration-100"
            style={{ color: "var(--on-surface-variant)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                "var(--surface-container-high)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4L12 12M12 4L4 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {extractState === "extracting" && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary-fixed-dim)"
                strokeWidth="2.5"
                className="animate-spin"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  strokeDasharray="31.4"
                  strokeDashoffset="10"
                />
              </svg>
              <span
                className="text-body-sm"
                style={{ color: "var(--on-surface-variant)" }}
              >
                Extracting video information...
              </span>
            </div>
          )}

          {extractState === "error" && !videoInfo && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--error)"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span
                className="text-body-sm text-center max-w-md"
                style={{ color: "var(--error)" }}
              >
                {error}
              </span>
              <button
                onClick={extractInfo}
                className="rounded-lg px-3 py-1.5 text-body-sm"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--primary-fixed-dim) 15%, transparent)",
                  color: "var(--primary-fixed-dim)",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {extractState === "done" && (
            <div className="flex flex-col gap-4">
              {/* Video Info Header */}
              {videoInfo && !playlistInfo && (
                <div className="flex gap-4">
                  {videoInfo.thumbnail && (
                    <img
                      src={videoInfo.thumbnail}
                      alt=""
                      className="rounded-lg object-cover flex-shrink-0"
                      style={{ width: 180, height: 100 }}
                      onError={(e) =>
                        (e.currentTarget.style.display = "none")
                      }
                    />
                  )}
                  <div className="flex flex-col gap-1 min-w-0">
                    <span
                      className="text-body-md font-semibold leading-snug line-clamp-2"
                      style={{ color: "var(--on-surface)" }}
                    >
                      {videoInfo.title}
                    </span>
                    <div
                      className="flex items-center gap-2 text-body-sm"
                      style={{ color: "var(--on-surface-variant)" }}
                    >
                      <span>{videoInfo.uploader}</span>
                      {videoInfo.duration > 0 && (
                        <>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <span>{formatDuration(videoInfo.duration)}</span>
                        </>
                      )}
                    </div>
                    {error && (
                      <span
                        className="text-body-sm mt-1"
                        style={{ color: "var(--error)", fontSize: "0.65rem" }}
                      >
                        {error}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Playlist Header */}
              {playlistInfo && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span
                        className="text-body-md font-semibold"
                        style={{ color: "var(--on-surface)" }}
                      >
                        {playlistInfo.title}
                      </span>
                      <div
                        className="text-body-sm"
                        style={{ color: "var(--on-surface-variant)" }}
                      >
                        {playlistInfo.uploader} &middot;{" "}
                        {playlistInfo.totalCount} videos
                      </div>
                    </div>
                    <button
                      onClick={toggleAllPlaylist}
                      className="text-body-sm"
                      style={{
                        color: "var(--primary-fixed-dim)",
                        fontSize: "0.65rem",
                      }}
                    >
                      {selectedPlaylistIds.size ===
                      playlistInfo.entries.length
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                  </div>

                  <div
                    className="rounded-lg overflow-y-auto"
                    style={{
                      backgroundColor: "var(--surface-container)",
                      maxHeight: 180,
                    }}
                  >
                    {playlistInfo.entries.map((entry, i) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 px-3 py-2 transition-colors duration-75"
                        style={{
                          borderBottom:
                            i < playlistInfo.entries.length - 1
                              ? "1px solid color-mix(in srgb, var(--outline) 8%, transparent)"
                              : undefined,
                          backgroundColor: selectedPlaylistIds.has(entry.id)
                            ? "color-mix(in srgb, var(--primary-fixed-dim) 5%, transparent)"
                            : undefined,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPlaylistIds.has(entry.id)}
                          onChange={() => togglePlaylistEntry(entry.id)}
                          className="accent-[var(--primary-fixed-dim)] flex-shrink-0"
                        />
                        {entry.thumbnail && (
                          <img
                            src={entry.thumbnail}
                            alt=""
                            className="rounded object-cover flex-shrink-0"
                            style={{ width: 48, height: 27 }}
                            onError={(e) =>
                              (e.currentTarget.style.display = "none")
                            }
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <span
                            className="text-body-sm truncate block font-medium"
                            style={{ color: "var(--on-surface)" }}
                          >
                            {entry.title}
                          </span>
                        </div>
                        {entry.duration && (
                          <span
                            className="text-mono-sm flex-shrink-0"
                            style={{
                              color: "var(--on-surface-variant)",
                              fontSize: "0.6rem",
                            }}
                          >
                            {formatDuration(entry.duration)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <span
                    className="text-body-sm"
                    style={{
                      color: "var(--on-surface-variant)",
                      fontSize: "0.6rem",
                    }}
                  >
                    {selectedPlaylistIds.size} of{" "}
                    {playlistInfo.entries.length} selected
                  </span>
                </div>
              )}

              {/* Quality & Format */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <SectionLabel>Quality</SectionLabel>
                  <select
                    value={qualityIndex}
                    onChange={(e) =>
                      setQualityIndex(parseInt(e.target.value, 10))
                    }
                    className="w-full rounded-lg px-3 py-2 text-body-sm outline-none"
                    style={{
                      backgroundColor: "var(--surface-container)",
                      color: "var(--on-surface)",
                      border:
                        "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
                    }}
                  >
                    {QUALITY_PRESETS.map((p, i) => (
                      <option key={i} value={i}>
                        {p.label} — {p.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 120 }}>
                  <SectionLabel>Format</SectionLabel>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-body-sm outline-none"
                    style={{
                      backgroundColor: "var(--surface-container)",
                      color: "var(--on-surface)",
                      border:
                        "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
                    }}
                  >
                    {OUTPUT_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {f.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subtitles */}
              {subtitleLangs.length > 0 && (
                <div>
                  <SectionLabel>Subtitles</SectionLabel>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {subtitleLangs.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => toggleSubtitle(lang)}
                        className="rounded-md px-2 py-1 text-body-sm transition-colors duration-75"
                        style={{
                          fontSize: "0.65rem",
                          backgroundColor: selectedSubtitles.has(lang)
                            ? "color-mix(in srgb, var(--primary-fixed-dim) 25%, transparent)"
                            : "var(--surface-container)",
                          color: selectedSubtitles.has(lang)
                            ? "var(--primary-fixed-dim)"
                            : "var(--on-surface-variant)",
                          border: selectedSubtitles.has(lang)
                            ? "1px solid color-mix(in srgb, var(--primary-fixed-dim) 40%, transparent)"
                            : "1px solid transparent",
                        }}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Formats (detailed) */}
              {videoInfo && videoInfo.formats.length > 0 && !playlistInfo && (
                <AvailableFormats formats={videoInfo.formats} />
              )}

              {/* Destination & Queue */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <SectionLabel>Destination</SectionLabel>
                  <FolderPicker value={savePath} onChange={setSavePath} />
                </div>
                <div style={{ width: 180 }}>
                  <SectionLabel>Queue</SectionLabel>
                  <select
                    value={queueId}
                    onChange={(e) => setQueueId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-body-sm outline-none"
                    style={{
                      backgroundColor: "var(--surface-container)",
                      color: "var(--on-surface)",
                      border:
                        "1px solid color-mix(in srgb, var(--primary-fixed-dim) 20%, transparent)",
                    }}
                  >
                    {queues.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{
            backgroundColor: "var(--surface-container)",
            flexShrink: 0,
          }}
        >
          <div className="text-body-sm" style={{ color: "var(--on-surface-variant)", fontSize: "0.65rem" }}>
            {playlistInfo
              ? `${selectedPlaylistIds.size} video${selectedPlaylistIds.size !== 1 ? "s" : ""}`
              : videoInfo
                ? formatDuration(videoInfo.duration)
                : ""}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-body-sm transition-colors duration-100"
              style={{ color: "var(--on-surface-variant)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--surface-container-high)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              Cancel
            </button>
            <button
              onClick={createVideoTasks}
              disabled={submitting || !isReady}
              className="rounded-lg px-4 py-2 text-body-sm font-semibold transition-colors duration-100"
              style={{
                backgroundColor: "var(--primary-fixed)",
                color: "var(--on-primary)",
                opacity: submitting || !isReady ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!submitting && isReady)
                  e.currentTarget.style.backgroundColor =
                    "var(--primary-fixed-dim)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--primary-fixed)";
              }}
            >
              {submitting
                ? "Creating..."
                : playlistInfo
                  ? `Download ${selectedPlaylistIds.size} Video${selectedPlaylistIds.size !== 1 ? "s" : ""}`
                  : "Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-label-md block mb-1"
      style={{ color: "var(--on-surface-variant)", fontSize: "0.65rem" }}
    >
      {children}
    </span>
  );
}

function AvailableFormats({ formats }: { formats: VideoFormat[] }) {
  const [expanded, setExpanded] = useState(false);

  const grouped = formats
    .filter((f) => f.hasVideo && f.height)
    .sort((a, b) => (b.height || 0) - (a.height || 0))
    .slice(0, expanded ? 20 : 5);

  const audioOnly = formats
    .filter((f) => f.hasAudio && !f.hasVideo)
    .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))
    .slice(0, 3);

  if (grouped.length === 0 && audioOnly.length === 0) return null;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="var(--on-surface-variant)"
          style={{
            transform: expanded ? "none" : "rotate(-90deg)",
            transition: "transform 100ms",
          }}
        >
          <path d="M1 2L4 6L7 2" />
        </svg>
        <SectionLabel>Available Formats</SectionLabel>
      </div>
      {expanded && (
        <div
          className="rounded-lg overflow-hidden mt-1"
          style={{ backgroundColor: "var(--surface-container)" }}
        >
          {grouped.map((f) => (
            <FormatRow key={f.formatId} format={f} />
          ))}
          {audioOnly.length > 0 && (
            <>
              <div
                className="px-3 py-1 text-label-sm"
                style={{
                  color: "var(--on-surface-variant)",
                  fontSize: "0.55rem",
                  backgroundColor: "var(--surface-container-high)",
                }}
              >
                AUDIO ONLY
              </div>
              {audioOnly.map((f) => (
                <FormatRow key={f.formatId} format={f} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FormatRow({ format }: { format: VideoFormat }) {
  const size =
    format.filesize || format.filesizeApprox;
  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 text-body-sm"
      style={{
        borderBottom:
          "1px solid color-mix(in srgb, var(--outline) 6%, transparent)",
        fontSize: "0.65rem",
      }}
    >
      <span
        style={{ color: "var(--on-surface)", width: 60 }}
        className="font-medium"
      >
        {format.formatNote || format.resolution || "?"}
      </span>
      <span style={{ color: "var(--on-surface-variant)", width: 36 }}>
        {format.ext}
      </span>
      <span style={{ color: "var(--on-surface-variant)", width: 64 }}>
        {size ? formatBytes(size) : "~"}
      </span>
      <span
        style={{ color: "var(--on-surface-variant)", opacity: 0.6 }}
        className="truncate"
      >
        {[format.vcodec, format.acodec].filter((c) => c && c !== "none").join(" + ")}
        {format.fps ? ` @${Math.round(format.fps)}fps` : ""}
      </span>
    </div>
  );
}

function PlatformIcon({ platform }: { platform: string | null }) {
  const color =
    platform === "youtube"
      ? "#FF0000"
      : platform === "facebook"
        ? "#1877F2"
        : platform === "instagram"
          ? "#E4405F"
          : platform === "tiktok"
            ? "#00F2EA"
            : platform === "twitter"
              ? "#1DA1F2"
              : "var(--primary-fixed-dim)";

  return (
    <div
      className="rounded-md flex items-center justify-center"
      style={{
        width: 24,
        height: 24,
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={color}
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </div>
  );
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function estimateFileSize(info: VideoInfo, qualityIndex: number): number {
  const preset = QUALITY_PRESETS[qualityIndex];
  const targetHeight =
    preset.label === "Best"
      ? 9999
      : preset.label === "Audio Only"
        ? 0
        : parseInt(preset.label) || 1080;

  const videoFormats = info.formats.filter(
    (f) => f.hasVideo && (f.height || 0) <= targetHeight + 50,
  );

  const best = videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  if (best) {
    return best.filesize || best.filesizeApprox || 0;
  }
  return 0;
}
