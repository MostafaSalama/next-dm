import { useState } from "react";
import { useQueuesStore } from "../../stores/queuesStore";
import { useTasksStore, getFileCategory, type CategoryFilter } from "../../stores/tasksStore";
import { SpeedHUD } from "./SpeedHUD";
import { QueueList } from "../sidebar/QueueList";

const CATEGORIES: { label: string; value: CategoryFilter; icon: string }[] = [
  { label: "All Files", value: "all", icon: "📁" },
  { label: "Video", value: "video", icon: "🎬" },
  { label: "Audio", value: "audio", icon: "🎵" },
  { label: "Documents", value: "document", icon: "📄" },
  { label: "Archives", value: "archive", icon: "📦" },
  { label: "Images", value: "image", icon: "🖼" },
  { label: "Programs", value: "executable", icon: "⚙" },
  { label: "Other", value: "other", icon: "📎" },
];

interface SidebarProps {
  onToggleSettings?: () => void;
  showSettings?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ onToggleSettings, showSettings, onNavigate }: SidebarProps) {
  const createQueue = useQueuesStore((s) => s.createQueue);
  const setActiveQueueId = useQueuesStore((s) => s.setActiveQueueId);
  const activeQueueId = useQueuesStore((s) => s.activeQueueId);
  const categoryFilter = useTasksStore((s) => s.categoryFilter);
  const setCategoryFilter = useTasksStore((s) => s.setCategoryFilter);
  const setFilterStatus = useTasksStore((s) => s.setFilterStatus);
  const tasks = useTasksStore((s) => s.tasks);

  const [showNewQueue, setShowNewQueue] = useState(false);
  const [newQueueName, setNewQueueName] = useState("");

  function taskCountForCategory(cat: CategoryFilter) {
    const filtered = activeQueueId
      ? tasks.filter((t) => t.queueId === activeQueueId)
      : tasks;
    if (cat === "all") return filtered.length;
    return filtered.filter((t) => getFileCategory(t.filename) === cat).length;
  }

  const handleCategoryClick = (cat: CategoryFilter) => {
    if (activeQueueId) {
      setActiveQueueId(null);
    }
    setFilterStatus("all");
    setCategoryFilter(cat);
    onNavigate?.();
  };

  const handleCreateQueue = async () => {
    const name = newQueueName.trim();
    if (!name) return;
    try {
      await createQueue(name, "");
      setNewQueueName("");
      setShowNewQueue(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <aside
      className="flex flex-col h-full overflow-hidden"
      style={{
        width: 250,
        minWidth: 250,
        backgroundColor: "var(--surface-container-low)",
      }}
    >
      <div className="flex-1 overflow-y-auto px-3 pt-4">
        {/* Queues */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-label-md"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Queues
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewQueue(true)}
              className="flex items-center justify-center rounded transition-colors duration-100"
              style={{
                width: 22,
                height: 22,
                color: "var(--on-surface-variant)",
                fontSize: "0.875rem",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "var(--surface-container-high)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              title="New queue"
            >
              +
            </button>
          </div>
        </div>

        {showNewQueue && (
          <div className="mb-2 flex gap-1">
            <input
              autoFocus
              placeholder="Queue name"
              value={newQueueName}
              onChange={(e) => setNewQueueName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateQueue();
                if (e.key === "Escape") {
                  setShowNewQueue(false);
                  setNewQueueName("");
                }
              }}
              className="flex-1 rounded-lg px-2 py-1 text-body-sm outline-none"
              style={{
                backgroundColor: "var(--surface-container)",
                color: "var(--on-surface)",
                border:
                  "1px solid color-mix(in srgb, var(--primary-fixed-dim) 30%, transparent)",
              }}
            />
            <button
              onClick={handleCreateQueue}
              className="rounded-lg px-2 py-1 text-body-sm"
              style={{ color: "var(--primary-fixed-dim)" }}
            >
              Add
            </button>
          </div>
        )}

        <QueueList onNavigate={onNavigate} />

        {/* Categories */}
        <div className="mt-5 mb-2">
          <span
            className="text-label-md"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Categories
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          {CATEGORIES.map((cat) => {
            const active = categoryFilter === cat.value;
            const count = taskCountForCategory(cat.value);
            return (
              <button
                key={cat.value}
                onClick={() => handleCategoryClick(cat.value)}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors duration-100"
                style={{
                  backgroundColor: active
                    ? "var(--surface-container-high)"
                    : "transparent",
                  color: active
                    ? "var(--on-surface)"
                    : "var(--on-surface-variant)",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    e.currentTarget.style.backgroundColor =
                      "var(--surface-container)";
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span style={{ fontSize: "0.8rem" }}>{cat.icon}</span>
                <span className="text-body-sm flex-1">{cat.label}</span>
                {count > 0 && (
                  <span
                    className="text-mono-sm"
                    style={{ opacity: 0.4, fontSize: "0.6rem" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom section */}
      <div className="px-3 pb-3">
        <SpeedHUD />

        <button
          onClick={onToggleSettings}
          className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-body-sm transition-colors duration-100 cursor-pointer"
          style={{
            color: showSettings ? "var(--primary-fixed)" : "var(--on-surface-variant)",
            backgroundColor: showSettings ? "var(--surface-container-high)" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (!showSettings)
              e.currentTarget.style.backgroundColor = "var(--surface-container)";
          }}
          onMouseLeave={(e) => {
            if (!showSettings)
              e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}
