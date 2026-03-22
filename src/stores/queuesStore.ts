import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Queue {
  id: string;
  name: string;
  savePath: string;
  maxConcurrent: number;
  speedLimit: number;
  sortOrder: number;
  isPaused: boolean;
  createdAt: string;
}

interface QueuesState {
  queues: Queue[];
  activeQueueId: string | null;

  setQueues: (queues: Queue[]) => void;
  createQueue: (name: string, savePath: string) => Promise<Queue>;
  updateQueue: (
    id: string,
    name: string,
    savePath: string,
    maxConcurrent: number,
    speedLimit: number,
  ) => Promise<void>;
  removeQueue: (id: string) => Promise<void>;
  setActiveQueueId: (id: string | null) => void;
  reorder: (ids: string[]) => Promise<void>;
  moveTasksToQueue: (taskIds: string[], queueId: string) => Promise<void>;
  setQueuePaused: (id: string, paused: boolean) => Promise<void>;
  patchQueueLocal: (id: string, patch: Partial<Queue>) => void;
}

export const useQueuesStore = create<QueuesState>((set, get) => ({
  queues: [],
  activeQueueId: null,

  setQueues: (queues) => set({ queues }),

  createQueue: async (name, savePath) => {
    const queue = await invoke<Queue>("create_queue", { name, savePath });
    set((state) => ({ queues: [...state.queues, queue] }));
    return queue;
  },

  updateQueue: async (id, name, savePath, maxConcurrent, speedLimit) => {
    const updated = await invoke<Queue>("update_queue", {
      id,
      name,
      savePath,
      maxConcurrent,
      speedLimit,
    });
    set((state) => ({
      queues: state.queues.map((q) => (q.id === id ? updated : q)),
    }));
  },

  removeQueue: async (id) => {
    await invoke("delete_queue", { id });
    set((state) => ({
      queues: state.queues.filter((q) => q.id !== id),
      activeQueueId: state.activeQueueId === id ? null : state.activeQueueId,
    }));
  },

  setActiveQueueId: (id) => {
    const current = get().activeQueueId;
    set({ activeQueueId: current === id ? null : id });
  },

  reorder: async (ids) => {
    set((state) => {
      const map = new Map(state.queues.map((q) => [q.id, q]));
      const reordered = ids
        .map((qid, i) => {
          const q = map.get(qid);
          return q ? { ...q, sortOrder: i } : null;
        })
        .filter(Boolean) as Queue[];
      return { queues: reordered };
    });
    await invoke("reorder_queues", { ids }).catch(console.error);
  },

  moveTasksToQueue: async (taskIds, queueId) => {
    await invoke("move_tasks_to_queue", { taskIds, queueId });
  },

  setQueuePaused: async (id, paused) => {
    await invoke("set_queue_paused", { id, paused });
    set((state) => ({
      queues: state.queues.map((q) => (q.id === id ? { ...q, isPaused: paused } : q)),
    }));
  },

  patchQueueLocal: (id, patch) =>
    set((state) => ({
      queues: state.queues.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    })),
}));
