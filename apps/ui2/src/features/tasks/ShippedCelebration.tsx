import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import "./ShippedCelebration.css";

type ShippedCelebrationProps = {
  trigger: number;
  durationMs?: number;
};

const DEFAULT_DURATION_MS = 2200;

export function ShippedCelebration({ trigger, durationMs = DEFAULT_DURATION_MS }: ShippedCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (trigger <= 0) return;
    setIsVisible(true);
    const timeout = window.setTimeout(() => setIsVisible(false), durationMs);
    return () => window.clearTimeout(timeout);
  }, [trigger, durationMs]);

  if (!isVisible) return null;

  return (
    <div
      className="shipped-celebration"
      style={{ "--celebration-duration": `${durationMs}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <div className="shipped-celebration__veil" />
      <div className="shipped-celebration__rocket" role="presentation">🚀</div>
      <div className="shipped-celebration__spark shipped-celebration__spark--one" />
      <div className="shipped-celebration__spark shipped-celebration__spark--two" />
      <div className="shipped-celebration__spark shipped-celebration__spark--three" />
    </div>
  );
}
