import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useQueuesStore } from "../../stores/queuesStore";
import { useTasksStore } from "../../stores/tasksStore";
import { QueueItem } from "./QueueItem";
import { QueueContextMenu } from "./QueueContextMenu";

interface QueueListProps {
  onNavigate?: () => void;
}

interface ContextMenuState {
  queueId: string;
  x: number;
  y: number;
}

export function QueueList({ onNavigate }: QueueListProps) {
  const queues = useQueuesStore((s) => s.queues);
  const activeQueueId = useQueuesStore((s) => s.activeQueueId);
  const setActiveQueueId = useQueuesStore((s) => s.setActiveQueueId);
  const reorder = useQueuesStore((s) => s.reorder);
  const tasks = useTasksStore((s) => s.tasks);
  const setCategoryFilter = useTasksStore((s) => s.setCategoryFilter);
  const setFilterStatus = useTasksStore((s) => s.setFilterStatus);
  const setShowArchive = useTasksStore((s) => s.setShowArchive);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function taskCountForQueue(queueId: string) {
    return tasks.filter(
      (t) =>
        t.queueId === queueId &&
        (t.status === "downloading" || t.status === "queued"),
    ).length;
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = queues.findIndex((q) => q.id === active.id);
      const newIndex = queues.findIndex((q) => q.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(
        queues.map((q) => q.id),
        oldIndex,
        newIndex,
      );
      reorder(newOrder);
    },
    [queues, reorder],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, queueId: string) => {
      e.preventDefault();
      setContextMenu({ queueId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  if (queues.length === 0) {
    return (
      <div
        className="text-body-sm py-4 text-center"
        style={{ color: "var(--on-surface-variant)", opacity: 0.5 }}
      >
        No queues yet
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={queues.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-0.5">
            {queues.map((q) => (
              <QueueItem
                key={q.id}
                queue={q}
                isActive={activeQueueId === q.id}
                taskCount={taskCountForQueue(q.id)}
                onClick={() => {
                  setCategoryFilter("all");
                  setFilterStatus("all");
                  setShowArchive(false);
                  setActiveQueueId(q.id);
                  onNavigate?.();
                }}
                onContextMenu={(e) => handleContextMenu(e, q.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {contextMenu && (
        <QueueContextMenu
          queueId={contextMenu.queueId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
