import { useCallback } from "react";
import { useTauriEvent } from "./useTauriEvents";
import { useTasksStore, type ChunkProgress } from "../stores/tasksStore";

interface ProgressPayload {
  id: string;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  etaSeconds: number;
  chunks: ChunkProgress[];
}

interface StatusChangePayload {
  id: string;
  oldStatus: string;
  newStatus: string;
  errorMessage?: string;
}

interface TaskCompletedPayload {
  id: string;
  filename: string;
  savePath: string;
}

export function useDownloadEvents() {
  const updateTask = useTasksStore((s) => s.updateTask);

  const onProgress = useCallback(
    (payload: ProgressPayload) => {
      updateTask(payload.id, {
        downloadedBytes: payload.downloadedBytes,
        totalBytes: payload.totalBytes,
        speedBps: payload.speedBps,
        etaSeconds: payload.etaSeconds,
        chunks: payload.chunks,
      });
    },
    [updateTask],
  );

  const onStatusChange = useCallback(
    (payload: StatusChangePayload) => {
      updateTask(payload.id, {
        status: payload.newStatus as "downloading" | "paused" | "completed" | "error" | "queued" | "pending",
        errorMessage: payload.errorMessage ?? null,
      });
    },
    [updateTask],
  );

  const onCompleted = useCallback(
    (payload: TaskCompletedPayload) => {
      updateTask(payload.id, {
        status: "completed",
      });
    },
    [updateTask],
  );

  useTauriEvent("progress_update", onProgress);
  useTauriEvent("status_change", onStatusChange);
  useTauriEvent("task_completed", onCompleted);
}
