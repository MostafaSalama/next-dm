import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQueuesStore } from "../../stores/queuesStore";
import { useTasksStore } from "../../stores/tasksStore";

interface QueueContextMenuProps {
  queueId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function QueueContextMenu({
  queueId,
  x,
  y,
  onClose,
}: QueueContextMenuProps) {
  const queue = useQueuesStore((s) => s.queues.find((q) => q.id === queueId));
  const queues = useQueuesStore((s) => s.queues);
  const updateQueue = useQueuesStore((s) => s.updateQueue);
  const removeQueue = useQueuesStore((s) => s.removeQueue);
  const setQueuePaused = useQueuesStore((s) => s.setQueuePaused);
  const tasks = useTasksStore((s) => s.tasks);
  const menuRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState<"rename" | "folder" | "concurrent" | "speed" | null>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  if (!queue) return null;

  const startEdit = (field: "rename" | "folder" | "concurrent" | "speed") => {
    setEditing(field);
    switch (field) {
      case "rename":
        setInputValue(queue.name);
        break;
      case "folder":
        setInputValue(queue.savePath);
        break;
      case "concurrent":
        setInputValue(String(queue.maxConcurrent));
        break;
      case "speed":
        setInputValue(String(queue.speedLimit));
        break;
    }
  };

  const commitEdit = async () => {
    if (!editing) return;
    const name = editing === "rename" ? inputValue : queue.name;
    const savePath = editing === "folder" ? inputValue : queue.savePath;
    const maxConcurrent =
      editing === "concurrent" ? parseInt(inputValue, 10) || 0 : queue.maxConcurrent;
    const speedLimit =
      editing === "speed" ? parseInt(inputValue, 10) || 0 : queue.speedLimit;

    try {
      await updateQueue(queue.id, name, savePath, maxConcurrent, speedLimit);
    } catch (e) {
      console.error(e);
    }
    setEditing(null);
    onClose();
  };

  const handleTogglePaused = async () => {
    try {
      await setQueuePaused(queueId, !queue.isPaused);
    } catch (e) {
      console.error(e);
    }
    onClose();
  };

  const handlePauseAll = async () => {
    const ids = tasks
      .filter((t) => t.queueId === queueId && t.status === "downloading")
      .map((t) => t.id);
    if (ids.length > 0) await invoke("pause_tasks", { ids });
    onClose();
  };

  const handleResumeAll = async () => {
    const ids = tasks
      .filter(
        (t) =>
          t.queueId === queueId &&
          (t.status === "paused" || t.status === "error"),
      )
      .map((t) => t.id);
    if (ids.length > 0) await invoke("resume_tasks", { ids });
    onClose();
  };

  const handleDelete = async () => {
    if (queues.length <= 1) return;
    try {
      await removeQueue(queueId);
    } catch (e) {
      console.error(e);
    }
    onClose();
  };

  if (editing) {
    const labels: Record<string, string> = {
      rename: "Queue Name",
      folder: "Save Folder",
      concurrent: "Max Concurrent (0 = global)",
      speed: "Speed Limit (bytes/s, 0 = unlimited)",
    };
    return (
      <div
        ref={menuRef}
        className="fixed z-50 rounded-xl p-3 flex flex-col gap-2"
        style={{
          left: x,
          top: y,
          backgroundColor: "var(--surface-container-highest)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          minWidth: 240,
        }}
      >
        <span className="text-label-md" style={{ color: "var(--on-surface-variant)" }}>
          {labels[editing]}
        </span>
        <input
          autoFocus
          type={editing === "concurrent" || editing === "speed" ? "number" : "text"}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") onClose();
          }}
          className="rounded-lg px-3 py-1.5 text-body-sm outline-none"
          style={{
            backgroundColor: "var(--surface-container)",
            color: "var(--on-surface)",
            border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 30%, transparent)",
          }}
        />
        <div className="flex gap-1 justify-end">
          <button
            onClick={onClose}
            className="text-body-sm px-2 py-1 rounded"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Cancel
          </button>
          <button
            onClick={commitEdit}
            className="text-body-sm px-2 py-1 rounded"
            style={{ color: "var(--primary-fixed-dim)" }}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-xl py-1.5 flex flex-col"
      style={{
        left: x,
        top: y,
        backgroundColor: "var(--surface-container-highest)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        minWidth: 180,
      }}
    >
      <MenuItem
        label={queue.isPaused ? "Start Queue" : "Pause Queue"}
        onClick={handleTogglePaused}
      />
      <div
        className="my-1"
        style={{ height: 1, backgroundColor: "var(--surface-container)" }}
      />
      <MenuItem label="Rename" onClick={() => startEdit("rename")} />
      <MenuItem label="Set Save Folder" onClick={() => startEdit("folder")} />
      <MenuItem label="Set Max Concurrent" onClick={() => startEdit("concurrent")} />
      <MenuItem label="Set Speed Limit" onClick={() => startEdit("speed")} />
      <div
        className="my-1"
        style={{ height: 1, backgroundColor: "var(--surface-container)" }}
      />
      <MenuItem label="Pause All Tasks" onClick={handlePauseAll} />
      <MenuItem label="Resume All Tasks" onClick={handleResumeAll} />
      <div
        className="my-1"
        style={{ height: 1, backgroundColor: "var(--surface-container)" }}
      />
      <MenuItem
        label="Delete Queue"
        onClick={handleDelete}
        danger
        disabled={queues.length <= 1}
      />
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-body-sm px-4 py-1.5 text-left transition-colors duration-100"
      style={{
        color: disabled
          ? "var(--on-surface-variant)"
          : danger
            ? "var(--error)"
            : "var(--on-surface)",
        opacity: disabled ? 0.3 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = "var(--surface-container)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {label}
    </button>
  );
}
