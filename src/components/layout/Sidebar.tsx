import { useSettingsStore } from "../../stores/settingsStore";
import { useQueuesStore } from "../../stores/queuesStore";
import { useTasksStore, getFileCategory, type CategoryFilter } from "../../stores/tasksStore";
import { SpeedHUD } from "./SpeedHUD";

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

export function Sidebar() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const queues = useQueuesStore((s) => s.queues);
  const activeQueueId = useQueuesStore((s) => s.activeQueueId);
  const setActiveQueueId = useQueuesStore((s) => s.setActiveQueueId);
  const categoryFilter = useTasksStore((s) => s.categoryFilter);
  const setCategoryFilter = useTasksStore((s) => s.setCategoryFilter);
  const tasks = useTasksStore((s) => s.tasks);

  function taskCountForQueue(queueId: string) {
    return tasks.filter(
      (t) => t.queueId === queueId && (t.status === "downloading" || t.status === "queued"),
    ).length;
  }

  function taskCountForCategory(cat: CategoryFilter) {
    if (cat === "all") return tasks.length;
    return tasks.filter((t) => getFileCategory(t.filename) === cat).length;
  }

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
          <button
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

        {queues.length === 0 ? (
          <div
            className="text-body-sm py-4 text-center"
            style={{ color: "var(--on-surface-variant)", opacity: 0.5 }}
          >
            No queues yet
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {queues.map((q) => {
              const active = activeQueueId === q.id;
              const count = taskCountForQueue(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQueueId(q.id)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors duration-100"
                  style={{
                    backgroundColor: active
                      ? "var(--surface-container-high)"
                      : "transparent",
                    color: "var(--on-surface)",
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
                  <span
                    className="rounded-full"
                    style={{
                      width: 7,
                      height: 7,
                      backgroundColor: "var(--primary-fixed-dim)",
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-body-sm truncate flex-1">{q.name}</span>
                  {count > 0 && (
                    <span
                      className="text-mono-sm rounded-full px-1.5 py-0.5"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--primary-fixed-dim) 15%, transparent)",
                        color: "var(--primary-fixed-dim)",
                        fontSize: "0.6rem",
                        minWidth: 18,
                        textAlign: "center",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

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
                onClick={() => setCategoryFilter(cat.value)}
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
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-body-sm transition-colors duration-100 cursor-pointer"
          style={{ color: "var(--on-surface-variant)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--surface-container)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          {theme === "dark" ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              Light Mode
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
              Dark Mode
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
