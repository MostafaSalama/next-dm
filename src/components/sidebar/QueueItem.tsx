import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Queue } from "../../stores/queuesStore";

interface QueueItemProps {
  queue: Queue;
  isActive: boolean;
  taskCount: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const QueueItem = memo(function QueueItem({
  queue,
  isActive,
  taskCount,
  onClick,
  onContextMenu,
}: QueueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: queue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-100 w-full group"
        style={{
          backgroundColor: isActive
            ? "var(--surface-container-high)"
            : "transparent",
          color: "var(--on-surface)",
        }}
        onMouseEnter={(e) => {
          if (!isActive)
            e.currentTarget.style.backgroundColor = "var(--surface-container)";
        }}
        onMouseLeave={(e) => {
          if (!isActive)
            e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        {/* Drag handle */}
        <span
          {...listeners}
          className="cursor-grab opacity-0 group-hover:opacity-40 transition-opacity duration-100"
          style={{ touchAction: "none" }}
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="10" height="10" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="3" cy="2" r="1.2" />
            <circle cx="7" cy="2" r="1.2" />
            <circle cx="3" cy="6" r="1.2" />
            <circle cx="7" cy="6" r="1.2" />
            <circle cx="3" cy="10" r="1.2" />
            <circle cx="7" cy="10" r="1.2" />
          </svg>
        </span>

        <span
          className="rounded-full"
          style={{
            width: 7,
            height: 7,
            backgroundColor: queue.isPaused
              ? "var(--on-surface-variant)"
              : "var(--primary-fixed-dim)",
            flexShrink: 0,
            opacity: queue.isPaused ? 0.4 : 1,
          }}
        />
        <span className="text-body-sm truncate flex-1">{queue.name}</span>
        {taskCount > 0 && (
          <span
            className="text-mono-sm rounded-full px-1.5 py-0.5"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--primary-fixed-dim) 15%, transparent)",
              color: "var(--primary-fixed-dim)",
              fontSize: "0.6rem",
              minWidth: 18,
              textAlign: "center",
            }}
          >
            {taskCount}
          </span>
        )}
      </button>
    </div>
  );
});
