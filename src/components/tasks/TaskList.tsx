import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTasksStore } from "../../stores/tasksStore";
import { TaskRow } from "./TaskRow";

const ROW_HEIGHT = 80;
const ROW_GAP = 8;

export function TaskList() {
  const filteredTasks = useTasksStore((s) => s.filteredTasks)();
  const toggleSelected = useTasksStore((s) => s.toggleSelected);
  const selectRange = useTasksStore((s) => s.selectRange);
  const clearSelection = useTasksStore((s) => s.clearSelection);

  const parentRef = useRef<HTMLDivElement>(null);
  const lastClickedId = useRef<string | null>(null);

  const virtualizer = useVirtualizer({
    count: filteredTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT + ROW_GAP,
    overscan: 5,
  });

  const handleRowClick = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      if (e.shiftKey && lastClickedId.current) {
        selectRange(lastClickedId.current, taskId);
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelected(taskId);
      } else {
        clearSelection();
        toggleSelected(taskId);
      }
      lastClickedId.current = taskId;
    },
    [toggleSelected, selectRange, clearSelection],
  );

  if (filteredTasks.length === 0) {
    return null;
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto px-5 py-2">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const task = filteredTasks[virtualRow.index];
          return (
            <div
              key={task.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: ROW_GAP,
              }}
              onClick={(e) => handleRowClick(e, task.id)}
            >
              <TaskRow task={task} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
