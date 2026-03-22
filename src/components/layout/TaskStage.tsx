import { useTasksStore, type TaskStatus } from "../../stores/tasksStore";
import { useTauriCommand } from "../../hooks/useTauriCommand";

const FILTER_TABS: { label: string; value: TaskStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Downloading", value: "downloading" },
  { label: "Queued", value: "queued" },
  { label: "Completed", value: "completed" },
  { label: "Errored", value: "error" },
];

export function TaskStage() {
  const filterStatus = useTasksStore((s) => s.filterStatus);
  const setFilterStatus = useTasksStore((s) => s.setFilterStatus);
  const filteredTasks = useTasksStore((s) => s.filteredTasks)();
  const selectedIds = useTasksStore((s) => s.selectedIds);
  const { execute: greet, loading } = useTauriCommand<{ name: string }, string>("greet");

  return (
    <main
      className="flex flex-col flex-1 h-full overflow-hidden"
      style={{ backgroundColor: "var(--surface-container-high)" }}
    >
      {/* Filter Bar */}
      <div
        className="flex items-center gap-1 px-6 pt-4 pb-2"
        style={{ flexShrink: 0 }}
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className="rounded-lg px-3 py-1.5 text-label-md transition-colors duration-150"
            style={{
              backgroundColor:
                filterStatus === tab.value
                  ? "var(--surface-container-highest)"
                  : "transparent",
              color:
                filterStatus === tab.value
                  ? "var(--on-surface)"
                  : "var(--on-surface-variant)",
            }}
            onMouseEnter={(e) => {
              if (filterStatus !== tab.value)
                e.currentTarget.style.backgroundColor =
                  "var(--surface-container)";
            }}
            onMouseLeave={(e) => {
              if (filterStatus !== tab.value)
                e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-6 py-2 text-body-sm"
          style={{
            backgroundColor: "var(--surface-container-highest)",
            color: "var(--on-surface)",
          }}
        >
          <span>{selectedIds.size} selected</span>
          <button
            className="text-label-md px-2 py-1 rounded transition-colors duration-150"
            style={{ color: "var(--primary-fixed-dim)" }}
          >
            Pause All
          </button>
          <button
            className="text-label-md px-2 py-1 rounded transition-colors duration-150"
            style={{ color: "var(--primary-fixed-dim)" }}
          >
            Resume All
          </button>
          <button
            className="text-label-md px-2 py-1 rounded transition-colors duration-150"
            style={{ color: "var(--error)" }}
          >
            Cancel All
          </button>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {filteredTasks.length === 0 ? (
          <EmptyState onTestIpc={greet} loading={loading} />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTasks.map((task) => (
              <TaskRowPlaceholder key={task.id} filename={task.filename} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState({
  onTestIpc,
  loading,
}: {
  onTestIpc: (args: { name: string }) => Promise<string | null>;
  loading: boolean;
}) {
  const handleTest = async () => {
    const result = await onTestIpc({ name: "Next DM" });
    if (result) alert(result);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div
        className="text-display-sm font-display"
        style={{ color: "var(--on-surface-variant)", opacity: 0.5 }}
      >
        No Downloads
      </div>
      <div
        className="text-body-md text-center max-w-xs"
        style={{ color: "var(--on-surface-variant)", opacity: 0.4 }}
      >
        Copy a URL or press Ctrl+V to add downloads.
        <br />
        They will appear here.
      </div>
      <button
        onClick={handleTest}
        disabled={loading}
        className="mt-4 rounded-lg px-4 py-2 text-body-md transition-colors duration-150"
        style={{
          backgroundColor: "var(--primary-fixed)",
          color: "var(--on-primary)",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Testing..." : "Test IPC Connection"}
      </button>
    </div>
  );
}

function TaskRowPlaceholder({ filename }: { filename: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3 transition-colors duration-150"
      style={{ backgroundColor: "var(--surface-container-highest)" }}
    >
      <span className="text-body-md" style={{ color: "var(--on-surface)" }}>
        {filename}
      </span>
    </div>
  );
}
