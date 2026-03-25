import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "./components/layout/TitleBar";
import { Sidebar } from "./components/layout/Sidebar";
import { TaskStage } from "./components/layout/TaskStage";
import { ArchiveView } from "./components/layout/ArchiveView";
import { SettingsView } from "./components/settings/SettingsView";
import { PreFlightModal } from "./components/modals/PreFlightModal";
import { ClipboardToast } from "./components/notifications/ClipboardToast";
import { useDownloadEvents } from "./hooks/useDownloadEvents";
import { useTasksStore, type Task } from "./stores/tasksStore";
import { useQueuesStore, type Queue } from "./stores/queuesStore";
import { useSettingsStore } from "./stores/settingsStore";

export function App() {
  const setTasks = useTasksStore((s) => s.setTasks);
  const setQueues = useQueuesStore((s) => s.setQueues);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const showArchiveView = useTasksStore((s) => s.showArchive);

  const [preFlightOpen, setPreFlightOpen] = useState(false);
  const [preFlightUrls, setPreFlightUrls] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useDownloadEvents();

  useEffect(() => {
    loadSettings();

    invoke<TaskFromBackend[]>("get_all_tasks").then((tasks) => {
      setTasks(
        tasks.map((t) => mapBackendTask(t)),
      );
    });

    invoke<Queue[]>("get_all_queues").then(setQueues);
  }, [setTasks, setQueues, loadSettings]);

  const openPreFlight = useCallback((urls: string[]) => {
    setPreFlightUrls(urls);
    setPreFlightOpen(true);
  }, []);

  const closePreFlight = useCallback(() => {
    setPreFlightOpen(false);
    setPreFlightUrls([]);
  }, []);

  const toggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  useEffect(() => {
    const handleComma = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleComma);
    return () => document.removeEventListener("keydown", handleComma);
  }, []);

  useEffect(() => {
    const handlePaste = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "v" &&
        !preFlightOpen
      ) {
        const activeTag = (document.activeElement as HTMLElement)?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") {
          return;
        }

        navigator.clipboard
          .readText()
          .then((text) => {
            const urls = text
              .split(/[\n\s]+/)
              .filter((u) => /^https?:\/\//.test(u.trim()))
              .map((u) => u.trim());
            if (urls.length > 0) {
              e.preventDefault();
              openPreFlight(urls);
            }
          })
          .catch(() => {});
      }
    };

    document.addEventListener("keydown", handlePaste);
    return () => document.removeEventListener("keydown", handlePaste);
  }, [preFlightOpen, openPreFlight]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onToggleSettings={toggleSettings} showSettings={showSettings} onNavigate={closeSettings} />
        {showSettings ? (
          <SettingsView />
        ) : showArchiveView ? (
          <ArchiveView />
        ) : (
          <TaskStage onOpenPreFlight={openPreFlight} />
        )}
      </div>

      {preFlightOpen && (
        <PreFlightModal urls={preFlightUrls} onClose={closePreFlight} />
      )}

      <ClipboardToast onAddToQueue={openPreFlight} />
    </div>
  );
}

interface ChunkFromBackend {
  chunkIndex: number;
  startByte: number;
  endByte: number;
  downloadedBytes: number;
}

interface TaskFromBackend {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  savePath: string;
  status: string;
  totalBytes: number;
  downloadedBytes: number;
  speedBps?: number;
  etaSeconds?: number;
  queueId: string;
  priority: number;
  tags: string;
  config: string;
  errorMessage: string | null;
  isArchived: boolean;
  chunks: ChunkFromBackend[];
  createdAt: string;
  updatedAt: string;
}

function mapBackendTask(t: TaskFromBackend): Task {
  return {
    id: t.id,
    url: t.url,
    filename: t.filename,
    originalName: t.originalName,
    savePath: t.savePath,
    status: t.status as Task["status"],
    totalBytes: t.totalBytes,
    downloadedBytes: t.downloadedBytes,
    speedBps: t.speedBps ?? 0,
    etaSeconds: t.etaSeconds ?? 0,
    queueId: t.queueId,
    priority: t.priority,
    tags: JSON.parse(t.tags || "[]"),
    errorMessage: t.errorMessage,
    isArchived: t.isArchived ?? false,
    chunks: (t.chunks ?? []).map((c: ChunkFromBackend) => ({
      index: c.chunkIndex,
      downloadedBytes: c.downloadedBytes,
      totalBytes: c.endByte - c.startByte + 1,
    })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
