import { useTasksStore, type TaskStatus } from "../../stores/tasksStore";

const FILTER_TABS: { label: string; value: TaskStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Downloading", value: "downloading" },
  { label: "Queued", value: "queued" },
  { label: "Completed", value: "completed" },
  { label: "Errored", value: "error" },
];

export function FilterBar() {
  const filterStatus = useTasksStore((s) => s.filterStatus);
  const setFilterStatus = useTasksStore((s) => s.setFilterStatus);
  const searchQuery = useTasksStore((s) => s.searchQuery);
  const setSearchQuery = useTasksStore((s) => s.setSearchQuery);
  const tasks = useTasksStore((s) => s.tasks);

  function countForStatus(status: TaskStatus | "all") {
    if (status === "all") return tasks.length;
    return tasks.filter((t) => t.status === status).length;
  }

  return (
    <div className="flex items-center gap-2 px-5 pt-3 pb-1" style={{ flexShrink: 0 }}>
      <div className="flex items-center gap-0.5">
        {FILTER_TABS.map((tab) => {
          const active = filterStatus === tab.value;
          const count = countForStatus(tab.value);
          return (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className="relative rounded-lg px-2.5 py-1.5 text-body-sm transition-all duration-150"
              style={{
                backgroundColor: active
                  ? "var(--surface-container-highest)"
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
              {tab.label}
              {count > 0 && (
                <span
                  className="ml-1.5 text-mono-sm"
                  style={{
                    opacity: active ? 0.8 : 0.5,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files..."
          className="rounded-lg pl-8 pr-3 py-1.5 text-body-sm outline-none transition-all duration-150"
          style={{
            width: 200,
            backgroundColor: "var(--surface-container)",
            color: "var(--on-surface)",
            border: "1px solid transparent",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor =
              "color-mix(in srgb, var(--primary-fixed-dim) 30%, transparent)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "transparent")
          }
        />
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--on-surface-variant)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-2.5 top-1/2 -translate-y-1/2"
          style={{ opacity: 0.5 }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
    </div>
  );
}
