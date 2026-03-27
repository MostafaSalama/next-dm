import { useMemo } from "react";
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useQueuesStore } from "./queuesStore";

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

export interface VideoMeta {
  taskType: "video";
  platform: string;
  videoId?: string;
  thumbnail?: string;
  duration?: number;
  resolution?: string;
  formatId?: string;
  outputFormat?: string;
  playlistTitle?: string;
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
  isArchived: boolean;
  chunks: ChunkProgress[];
  createdAt: string;
  updatedAt: string;
  videoMeta?: VideoMeta;
}

export type CategoryFilter =
  | "all"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "image"
  | "executable"
  | "other";

const CATEGORY_EXTENSIONS: Record<Exclude<CategoryFilter, "all" | "other">, string[]> = {
  video: ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "ts"],
  audio: ["mp3", "flac", "wav", "aac", "ogg", "wma", "m4a", "opus"],
  document: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso"],
  image: ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "tiff"],
  executable: ["exe", "msi", "dmg", "deb", "rpm", "appimage", "apk"],
};

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function getFileCategory(filename: string): CategoryFilter {
  const ext = getFileExtension(filename);
  if (!ext) return "other";
  for (const [cat, exts] of Object.entries(CATEGORY_EXTENSIONS)) {
    if (exts.includes(ext)) return cat as CategoryFilter;
  }
  return "other";
}

interface TasksState {
  tasks: Task[];
  archivedTasks: Task[];
  showArchive: boolean;
  selectedIds: Set<string>;
  filterStatus: TaskStatus | "all";
  searchQuery: string;
  categoryFilter: CategoryFilter;

  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setFilterStatus: (status: TaskStatus | "all") => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (cat: CategoryFilter) => void;
  toggleSelected: (id: string) => void;
  selectRange: (fromId: string, toId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  filteredTasks: () => Task[];
  setShowArchive: (show: boolean) => void;
  setArchivedTasks: (tasks: Task[]) => void;
  archiveTasks: (ids: string[]) => Promise<void>;
  unarchiveTasks: (ids: string[]) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  archivedTasks: [],
  showArchive: false,
  selectedIds: new Set(),
  filterStatus: "all",
  searchQuery: "",
  categoryFilter: "all",

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
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

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

  setShowArchive: (show) => set({ showArchive: show }),
  setArchivedTasks: (archivedTasks) => set({ archivedTasks }),

  archiveTasks: async (ids) => {
    await invoke("archive_tasks", { ids });
    set((state) => {
      const toArchive = state.tasks.filter((t) => ids.includes(t.id));
      return {
        tasks: state.tasks.filter((t) => !ids.includes(t.id)),
        archivedTasks: [...toArchive.map((t) => ({ ...t, isArchived: true })), ...state.archivedTasks],
        selectedIds: new Set([...state.selectedIds].filter((sid) => !ids.includes(sid))),
      };
    });
  },

  unarchiveTasks: async (ids) => {
    await invoke("unarchive_tasks", { ids });
    set((state) => {
      const toRestore = state.archivedTasks.filter((t) => ids.includes(t.id));
      return {
        archivedTasks: state.archivedTasks.filter((t) => !ids.includes(t.id)),
        tasks: [...state.tasks, ...toRestore.map((t) => ({ ...t, isArchived: false }))],
        selectedIds: new Set([...state.selectedIds].filter((sid) => !ids.includes(sid))),
      };
    });
  },

  filteredTasks: () => {
    const { tasks, filterStatus, searchQuery, categoryFilter } = get();
    const activeQueueId = useQueuesStore.getState().activeQueueId;
    return computeFilteredTasks(tasks, filterStatus, categoryFilter, searchQuery, activeQueueId);
  },
}));

function computeFilteredTasks(
  tasks: Task[],
  filterStatus: TaskStatus | "all",
  categoryFilter: CategoryFilter,
  searchQuery: string,
  activeQueueId: string | null,
): Task[] {
  let result = tasks;

  if (activeQueueId) {
    result = result.filter((t) => t.queueId === activeQueueId);
  }

  if (filterStatus !== "all") {
    result = result.filter((t) => t.status === filterStatus);
  }

  if (categoryFilter !== "all") {
    result = result.filter((t) => getFileCategory(t.filename) === categoryFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (t) =>
        t.filename.toLowerCase().includes(q) ||
        t.url.toLowerCase().includes(q),
    );
  }

  return result;
}

export function useFilteredTasks(): Task[] {
  const tasks = useTasksStore((s) => s.tasks);
  const filterStatus = useTasksStore((s) => s.filterStatus);
  const categoryFilter = useTasksStore((s) => s.categoryFilter);
  const searchQuery = useTasksStore((s) => s.searchQuery);
  const activeQueueId = useQueuesStore((s) => s.activeQueueId);

  return useMemo(
    () => computeFilteredTasks(tasks, filterStatus, categoryFilter, searchQuery, activeQueueId),
    [tasks, filterStatus, categoryFilter, searchQuery, activeQueueId],
  );
}
