import { create } from "zustand";

export type TaskStatus =
  | "pending"
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "error";

export interface ChunkProgress {
  index: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface Task {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  savePath: string;
  status: TaskStatus;
  totalBytes: number;
  downloadedBytes: number;
  speedBps: number;
  etaSeconds: number;
  queueId: string;
  priority: number;
  tags: string[];
  errorMessage: string | null;
  chunks: ChunkProgress[];
  createdAt: string;
  updatedAt: string;
}

interface TasksState {
  tasks: Task[];
  selectedIds: Set<string>;
  filterStatus: TaskStatus | "all";

  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setFilterStatus: (status: TaskStatus | "all") => void;
  toggleSelected: (id: string) => void;
  selectRange: (fromId: string, toId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  filteredTasks: () => Task[];
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  selectedIds: new Set(),
  filterStatus: "all",

  setTasks: (tasks) => set({ tasks }),

  updateTask: (id, patch) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
    })),

  setFilterStatus: (filterStatus) => set({ filterStatus }),

  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  selectRange: (fromId, toId) =>
    set((state) => {
      const list = get().filteredTasks();
      const fromIdx = list.findIndex((t) => t.id === fromId);
      const toIdx = list.findIndex((t) => t.id === toId);
      if (fromIdx === -1 || toIdx === -1) return state;
      const lo = Math.min(fromIdx, toIdx);
      const hi = Math.max(fromIdx, toIdx);
      const next = new Set(state.selectedIds);
      for (let i = lo; i <= hi; i++) next.add(list[i].id);
      return { selectedIds: next };
    }),

  selectAll: () =>
    set(() => ({
      selectedIds: new Set(get().filteredTasks().map((t) => t.id)),
    })),

  clearSelection: () => set({ selectedIds: new Set() }),

  filteredTasks: () => {
    const { tasks, filterStatus } = get();
    if (filterStatus === "all") return tasks;
    return tasks.filter((t) => t.status === filterStatus);
  },
}));
