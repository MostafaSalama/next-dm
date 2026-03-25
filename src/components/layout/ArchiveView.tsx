import { invoke } from "@tauri-apps/api/core";
import { useTasksStore } from "../../stores/tasksStore";
import { FileIcon } from "../../lib/fileIcons";
import { formatBytes } from "../../lib/formatters";

export function ArchiveView() {
  const archivedTasks = useTasksStore((s) => s.archivedTasks);
  const unarchiveTasks = useTasksStore((s) => s.unarchiveTasks);
  const setArchivedTasks = useTasksStore((s) => s.setArchivedTasks);

  const handleUnarchive = async (ids: string[]) => {
    try {
      await unarchiveTasks(ids);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePermanently = async (ids: string[]) => {
    try {
      await invoke("delete_tasks", { ids });
      setArchivedTasks(archivedTasks.filter((t) => !ids.includes(t.id)));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main
      className="flex flex-col flex-1 h-full overflow-hidden"
      style={{ backgroundColor: "var(--surface-container-high)" }}
    >
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ flexShrink: 0 }}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-variant)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
          <span className="text-title-sm font-display" style={{ color: "var(--on-surface)" }}>
            Archive
          </span>
          <span
            className="text-mono-sm"
            style={{ color: "var(--on-surface-variant)", opacity: 0.5 }}
          >
            {archivedTasks.length} items
          </span>
        </div>
        {archivedTasks.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => handleUnarchive(archivedTasks.map((t) => t.id))}
              className="text-body-sm px-2.5 py-1 rounded-md transition-colors duration-100"
              style={{ color: "var(--primary-fixed-dim)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--surface-container)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              Restore All
            </button>
            <button
              onClick={() => handleDeletePermanently(archivedTasks.map((t) => t.id))}
              className="text-body-sm px-2.5 py-1 rounded-md transition-colors duration-100"
              style={{ color: "var(--error)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--surface-container)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              Delete All
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {archivedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 h-full gap-3">
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
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            <div
              className="text-title-sm font-display"
              style={{ color: "var(--on-surface-variant)", opacity: 0.3 }}
            >
              Archive is empty
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {archivedTasks.map((task) => (
              <div
                key={task.id}
                className="group rounded-xl px-4 py-3 transition-colors duration-100"
                style={{ backgroundColor: "var(--surface-container-highest)" }}
              >
                <div className="flex items-center gap-3">
                  <FileIcon filename={task.filename} />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className="text-body-md truncate"
                      style={{ color: "var(--on-surface)" }}
                    >
                      {task.filename}
                    </span>
                    <span
                      className="text-mono-sm truncate mt-0.5"
                      style={{ color: "var(--on-surface-variant)", opacity: 0.5 }}
                    >
                      {task.url}
                    </span>
                  </div>
                  <span className="text-mono-sm" style={{ color: "var(--on-surface-variant)" }}>
                    {task.totalBytes > 0 ? formatBytes(task.totalBytes) : ""}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                    <button
                      onClick={() => handleUnarchive([task.id])}
                      title="Restore"
                      className="flex items-center justify-center rounded-md transition-colors duration-100"
                      style={{ width: 26, height: 26, color: "var(--primary-fixed-dim)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "var(--surface-container)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 105.36-10.36L1 10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeletePermanently([task.id])}
                      title="Delete permanently"
                      className="flex items-center justify-center rounded-md transition-colors duration-100"
                      style={{ width: 26, height: 26, color: "var(--error)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "var(--surface-container)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
