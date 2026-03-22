import { useState, useEffect, useCallback } from "react";
import { formatSpeed } from "../../lib/formatters";

interface SpeedLimiterProps {
  value: number;
  onChange: (bytesPerSec: number) => void;
}

type Unit = "KB/s" | "MB/s";

const KB = 1024;
const MB = 1024 * 1024;

function toDisplay(bps: number, unit: Unit): number {
  if (bps === 0) return 0;
  return unit === "MB/s" ? bps / MB : bps / KB;
}

function toBps(display: number, unit: Unit): number {
  if (display === 0) return 0;
  return Math.round(unit === "MB/s" ? display * MB : display * KB);
}

export function SpeedLimiter({ value, onChange }: SpeedLimiterProps) {
  const [unit, setUnit] = useState<Unit>(value >= MB ? "MB/s" : "KB/s");
  const [displayVal, setDisplayVal] = useState(() => toDisplay(value, unit));

  useEffect(() => {
    const u = value >= MB ? "MB/s" : "KB/s";
    setUnit(u);
    setDisplayVal(toDisplay(value, u));
  }, [value]);

  const maxSlider = unit === "MB/s" ? 100 : 10240;

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setDisplayVal(v);
      onChange(toBps(v, unit));
    },
    [unit, onChange],
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value) || 0;
      setDisplayVal(v);
      onChange(toBps(v, unit));
    },
    [unit, onChange],
  );

  const toggleUnit = useCallback(() => {
    const newUnit: Unit = unit === "KB/s" ? "MB/s" : "KB/s";
    const bps = toBps(displayVal, unit);
    const newDisplay = toDisplay(bps, newUnit);
    setUnit(newUnit);
    setDisplayVal(newDisplay);
  }, [unit, displayVal]);

  const isUnlimited = value === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={maxSlider}
          step={unit === "MB/s" ? 0.5 : 64}
          value={displayVal}
          onChange={handleSlider}
          className="flex-1 accent-[var(--primary-fixed-dim)]"
          style={{ height: 4 }}
        />
        <input
          type="number"
          min={0}
          value={displayVal}
          onChange={handleInput}
          className="rounded-lg px-2 py-1.5 text-body-sm text-right outline-none"
          style={{
            width: 80,
            backgroundColor: "var(--surface-container)",
            color: "var(--on-surface)",
            border: "1px solid color-mix(in srgb, var(--primary-fixed-dim) 30%, transparent)",
          }}
        />
        <button
          onClick={toggleUnit}
          className="rounded-lg px-2 py-1.5 text-body-sm transition-colors duration-100"
          style={{
            backgroundColor: "var(--surface-container-high)",
            color: "var(--primary-fixed-dim)",
            minWidth: 50,
            textAlign: "center",
          }}
        >
          {unit}
        </button>
      </div>
      <span
        className="text-body-sm"
        style={{ color: "var(--on-surface-variant)" }}
      >
        {isUnlimited ? "Unlimited" : `Capped at ${formatSpeed(value)}`}
      </span>
    </div>
  );
}
