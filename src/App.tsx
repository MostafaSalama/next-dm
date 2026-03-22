import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "./components/layout/TitleBar";
import { Sidebar } from "./components/layout/Sidebar";
import { TaskStage } from "./components/layout/TaskStage";
import { useDownloadEvents } from "./hooks/useDownloadEvents";
import { useTasksStore, type Task } from "./stores/tasksStore";
import { useQueuesStore, type Queue } from "./stores/queuesStore";

export function App() {
  const setTasks = useTasksStore((s) => s.setTasks);
  const setQueues = useQueuesStore((s) => s.setQueues);

  useDownloadEvents();

  useEffect(() => {
    invoke<TaskFromBackend[]>("get_all_tasks").then((tasks) => {
      setTasks(
        tasks.map((t) => ({
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
          chunks: (t.chunks ?? []).map((c: ChunkFromBackend) => ({
            index: c.chunkIndex,
            downloadedBytes: c.downloadedBytes,
            totalBytes: c.endByte - c.startByte + 1,
          })),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      );
    });

    invoke<Queue[]>("get_all_queues").then(setQueues);
  }, [setTasks, setQueues]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <TaskStage />
      </div>
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
  chunks: ChunkFromBackend[];
  createdAt: string;
  updatedAt: string;
}
