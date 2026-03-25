import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTasksStore, useFilteredTasks } from "../../stores/tasksStore";
import { useQueuesStore } from "../../stores/queuesStore";
import { AddUrlBar } from "../tasks/AddUrlBar";
import { FilterBar } from "../tasks/FilterBar";
import { TaskList } from "../tasks/TaskList";

interface TaskStageProps {
  onOpenPreFlight: (urls: string[]) => void;
}

export function TaskStage({ onOpenPreFlight }: TaskStageProps) {
  const selectedIds = useTasksStore((s) => s.selectedIds);
  const clearSelection = useTasksStore((s) => s.clearSelection);
  const archiveTasks = useTasksStore((s) => s.archiveTasks);
  const filteredTasks = useFilteredTasks();

  return (
    <main
      className="flex flex-col flex-1 h-full overflow-hidden"
      style={{ backgroundColor: "var(--surface-container-high)" }}
    >
      <AddUrlBar onOpenPreFlight={onOpenPreFlight} />
      <FilterBar />

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-5 py-2"
          style={{
            backgroundColor: "var(--surface-container-highest)",
            flexShrink: 0,
          }}
        >
          <span className="text-body-sm" style={{ color: "var(--on-surface)" }}>
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <BulkAction
            label="Pause"
            onClick={() => invoke("pause_tasks", { ids: [...selectedIds] })}
          />
          <BulkAction
            label="Resume"
            onClick={() => invoke("resume_tasks", { ids: [...selectedIds] })}
          />
          <MoveToQueueDropdown selectedIds={selectedIds} />
          <BulkAction
            label="Archive"
            onClick={() => archiveTasks([...selectedIds])}
          />
          <BulkAction
            label="Cancel"
            onClick={() => invoke("cancel_tasks", { ids: [...selectedIds] })}
            danger
          />
          <span
            style={{
              width: 1,
              height: 16,
              backgroundColor: "var(--surface-container)",
              flexShrink: 0,
            }}
          />
          <BulkAction
            label="Clear Selection"
            onClick={clearSelection}
          />
        </div>
      )}

      {/* Content area */}
      {filteredTasks.length === 0 ? <EmptyState /> : <TaskList />}
    </main>
  );
}

function MoveToQueueDropdown({ selectedIds }: { selectedIds: Set<string> }) {
  const queues = useQueuesStore((s) => s.queues);
  const moveTasksToQueue = useQueuesStore((s) => s.moveTasksToQueue);
  const updateTask = useTasksStore((s) => s.updateTask);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMove = async (queueId: string) => {
    const ids = [...selectedIds];
    try {
      await moveTasksToQueue(ids, queueId);
      for (const id of ids) updateTask(id, { queueId });
    } catch (e) {
      console.error(e);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-body-sm px-2.5 py-1 rounded-md transition-colors duration-100 flex items-center gap-1"
        style={{ color: "var(--primary-fixed-dim)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--surface-container)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        Move to Queue
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 100ms",
          }}
        >
          <path d="M2 3.5L5 7L8 3.5" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 z-50 rounded-xl py-1.5 flex flex-col"
          style={{
            backgroundColor: "var(--surface-container-highest)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            minWidth: 160,
          }}
        >
          {queues.map((q) => (
            <button
              key={q.id}
              onClick={() => handleMove(q.id)}
              className="text-body-sm px-4 py-1.5 text-left transition-colors duration-100"
              style={{ color: "var(--on-surface)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--surface-container)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              {q.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BulkAction({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="text-body-sm px-2.5 py-1 rounded-md transition-colors duration-100"
      style={{
        color: danger ? "var(--error)" : "var(--primary-fixed-dim)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--surface-container)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--on-surface-variant)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.2 }}
      >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <div
        className="text-title-sm font-display"
        style={{ color: "var(--on-surface-variant)", opacity: 0.3 }}
      >
        No downloads yet
      </div>
      <div
        className="text-body-sm text-center max-w-xs"
        style={{ color: "var(--on-surface-variant)", opacity: 0.2 }}
      >
        Paste a URL in the bar above to start downloading
      </div>
    </div>
  );
}
