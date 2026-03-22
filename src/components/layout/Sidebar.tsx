import { useSettingsStore } from "../../stores/settingsStore";
import { useQueuesStore } from "../../stores/queuesStore";

export function Sidebar() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const queues = useQueuesStore((s) => s.queues);
  const activeQueueId = useQueuesStore((s) => s.activeQueueId);
  const setActiveQueueId = useQueuesStore((s) => s.setActiveQueueId);

  return (
    <aside
      className="flex flex-col h-full overflow-hidden"
      style={{
        width: 260,
        minWidth: 260,
        backgroundColor: "var(--surface-container-low)",
      }}
    >
      {/* Queues Section */}
      <div className="flex-1 overflow-y-auto px-3 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-label-md"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Queues
          </span>
          <button
            className="flex items-center justify-center rounded transition-colors duration-150"
            style={{
              width: 24,
              height: 24,
              color: "var(--on-surface-variant)",
              fontSize: "1rem",
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
            className="text-body-sm py-6 text-center"
            style={{ color: "var(--on-surface-variant)" }}
          >
            No queues yet
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {queues.map((q) => (
              <button
                key={q.id}
                onClick={() => setActiveQueueId(q.id)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors duration-150"
                style={{
                  backgroundColor:
                    activeQueueId === q.id
                      ? "var(--surface-container-high)"
                      : "transparent",
                  color: "var(--on-surface)",
                }}
                onMouseEnter={(e) => {
                  if (activeQueueId !== q.id)
                    e.currentTarget.style.backgroundColor =
                      "var(--surface-container)";
                }}
                onMouseLeave={(e) => {
                  if (activeQueueId !== q.id)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: "var(--primary-fixed-dim)",
                    flexShrink: 0,
                  }}
                />
                <span className="text-body-md truncate">{q.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Categories Section */}
        <div className="mt-6 mb-3">
          <span
            className="text-label-md"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Categories
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {["All Files", "Video", "Audio", "Documents", "Archives", "Images"].map(
            (cat) => (
              <div
                key={cat}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-body-md transition-colors duration-150 cursor-pointer"
                style={{ color: "var(--on-surface-variant)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "var(--surface-container)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                {cat}
              </div>
            ),
          )}
        </div>
      </div>

      {/* Speed HUD */}
      <div className="px-3 pb-3">
        <div
          className="glass rounded-xl p-4"
          style={{ borderRadius: "1rem" }}
        >
          <div
            className="text-display-sm"
            style={{ color: "var(--primary-fixed)", lineHeight: 1.1 }}
          >
            0.0 <span className="text-body-sm" style={{ color: "var(--on-surface-variant)" }}>MB/s</span>
          </div>
          <div
            className="text-body-sm mt-1"
            style={{ color: "var(--on-surface-variant)" }}
          >
            0 active
          </div>
          {/* Sparkline placeholder */}
          <svg
            viewBox="0 0 200 40"
            className="mt-2 w-full"
            style={{ height: 32, opacity: 0.5 }}
          >
            <polyline
              fill="none"
              stroke="var(--primary-fixed-dim)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="0,38 10,36 20,35 30,37 40,34 50,38 60,36 70,38 80,37 90,38 100,38 110,38 120,38 130,38 140,38 150,38 160,38 170,38 180,38 190,38 200,38"
            />
          </svg>
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="mt-2 w-full rounded-lg px-3 py-2 text-body-sm text-center transition-colors duration-150 cursor-pointer"
          style={{ color: "var(--on-surface-variant)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--surface-container)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          {theme === "dark" ? "☀ Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>
    </aside>
  );
}
