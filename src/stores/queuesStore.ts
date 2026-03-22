import { create } from "zustand";

export interface Queue {
  id: string;
  name: string;
  savePath: string;
  maxConcurrent: number;
  speedLimit: number;
  sortOrder: number;
  createdAt: string;
}

interface QueuesState {
  queues: Queue[];
  activeQueueId: string | null;

  setQueues: (queues: Queue[]) => void;
  addQueue: (queue: Queue) => void;
  updateQueue: (id: string, patch: Partial<Queue>) => void;
  removeQueue: (id: string) => void;
  setActiveQueueId: (id: string | null) => void;
  reorder: (ids: string[]) => void;
}

export const useQueuesStore = create<QueuesState>((set) => ({
  queues: [],
  activeQueueId: null,

  setQueues: (queues) => set({ queues }),

  addQueue: (queue) =>
    set((state) => ({ queues: [...state.queues, queue] })),

  updateQueue: (id, patch) =>
    set((state) => ({
      queues: state.queues.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    })),

  removeQueue: (id) =>
    set((state) => ({
      queues: state.queues.filter((q) => q.id !== id),
      activeQueueId: state.activeQueueId === id ? null : state.activeQueueId,
    })),

  setActiveQueueId: (id) => set({ activeQueueId: id }),

  reorder: (ids) =>
    set((state) => {
      const map = new Map(state.queues.map((q) => [q.id, q]));
      const reordered = ids
        .map((id, i) => {
          const q = map.get(id);
          return q ? { ...q, sortOrder: i } : null;
        })
        .filter(Boolean) as Queue[];
      return { queues: reordered };
    }),
}));
