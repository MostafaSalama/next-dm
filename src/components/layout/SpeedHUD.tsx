import { useEffect, useRef, useState } from "react";
import { useTasksStore } from "../../stores/tasksStore";
import { formatSpeed } from "../../lib/formatters";

const MAX_POINTS = 60;
const SPARKLINE_W = 200;
const SPARKLINE_H = 36;

export function SpeedHUD() {
  const tasks = useTasksStore((s) => s.tasks);
  const [history, setHistory] = useState<number[]>(() => Array.from({ length: MAX_POINTS }, () => 0));
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const activeTasks = tasks.filter((t) => t.status === "downloading");
  const aggregateSpeed = activeTasks.reduce((sum, t) => sum + t.speedBps, 0);
  const activeCount = activeTasks.length;

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const currentTasks = useTasksStore.getState().tasks;
      const speed = currentTasks
        .filter((t) => t.status === "downloading")
        .reduce((sum, t) => sum + t.speedBps, 0);
      setHistory((prev) => {
        const next = [...prev.slice(1), speed];
        return next;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  const maxSpeed = Math.max(...history, 1);
  const points = history
    .map((val, i) => {
      const x = (i / (MAX_POINTS - 1)) * SPARKLINE_W;
      const y = SPARKLINE_H - (val / maxSpeed) * (SPARKLINE_H - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${SPARKLINE_H} ${points} ${SPARKLINE_W},${SPARKLINE_H}`;

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-baseline gap-2">
        <span
          className="text-display-sm"
          style={{ color: "var(--primary-fixed)", lineHeight: 1.1 }}
        >
          {aggregateSpeed > 0 ? formatSpeed(aggregateSpeed) : "0 B/s"}
        </span>
      </div>
      <div
        className="text-body-sm mt-1"
        style={{ color: "var(--on-surface-variant)" }}
      >
        {activeCount} active {activeCount === 1 ? "download" : "downloads"}
      </div>

      <svg
        viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`}
        className="mt-2 w-full"
        style={{ height: SPARKLINE_H }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary-fixed-dim)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--primary-fixed-dim)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          fill="url(#sparkGrad)"
          points={areaPoints}
        />
        <polyline
          fill="none"
          stroke="var(--primary-fixed-dim)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}
