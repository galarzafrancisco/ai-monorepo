import type { CSSProperties } from "react";
import "./ShippedCelebrationOverlay.css";

type ShippedCelebrationOverlayProps = {
  label?: string;
};

const confettiPieces: Array<CSSProperties & Record<string, string>> = [
  { "--confetti-left": "12%", "--confetti-delay": "0ms", "--confetti-duration": "900ms", "--confetti-size": "6px", "--confetti-drift": "-16px", "--confetti-color": "var(--accent)" },
  { "--confetti-left": "18%", "--confetti-delay": "60ms", "--confetti-duration": "1000ms", "--confetti-size": "5px", "--confetti-drift": "12px", "--confetti-color": "var(--success)" },
  { "--confetti-left": "26%", "--confetti-delay": "140ms", "--confetti-duration": "960ms", "--confetti-size": "4px", "--confetti-drift": "-10px", "--confetti-color": "var(--warning)" },
  { "--confetti-left": "34%", "--confetti-delay": "40ms", "--confetti-duration": "880ms", "--confetti-size": "5px", "--confetti-drift": "18px", "--confetti-color": "var(--accent)" },
  { "--confetti-left": "42%", "--confetti-delay": "120ms", "--confetti-duration": "980ms", "--confetti-size": "6px", "--confetti-drift": "-8px", "--confetti-color": "var(--success)" },
  { "--confetti-left": "50%", "--confetti-delay": "0ms", "--confetti-duration": "940ms", "--confetti-size": "5px", "--confetti-drift": "10px", "--confetti-color": "var(--accent)" },
  { "--confetti-left": "58%", "--confetti-delay": "80ms", "--confetti-duration": "1020ms", "--confetti-size": "4px", "--confetti-drift": "-14px", "--confetti-color": "var(--warning)" },
  { "--confetti-left": "66%", "--confetti-delay": "160ms", "--confetti-duration": "920ms", "--confetti-size": "6px", "--confetti-drift": "16px", "--confetti-color": "var(--success)" },
  { "--confetti-left": "72%", "--confetti-delay": "40ms", "--confetti-duration": "980ms", "--confetti-size": "5px", "--confetti-drift": "-12px", "--confetti-color": "var(--accent)" },
  { "--confetti-left": "80%", "--confetti-delay": "120ms", "--confetti-duration": "940ms", "--confetti-size": "4px", "--confetti-drift": "14px", "--confetti-color": "var(--success)" },
  { "--confetti-left": "86%", "--confetti-delay": "200ms", "--confetti-duration": "1040ms", "--confetti-size": "5px", "--confetti-drift": "-18px", "--confetti-color": "var(--warning)" },
  { "--confetti-left": "92%", "--confetti-delay": "80ms", "--confetti-duration": "920ms", "--confetti-size": "6px", "--confetti-drift": "12px", "--confetti-color": "var(--accent)" },
];

export function ShippedCelebrationOverlay({ label = "Shipped" }: ShippedCelebrationOverlayProps) {
  return (
    <div className="shipped-celebration" aria-hidden="true">
      <div className="shipped-celebration__backdrop" />
      <div className="shipped-celebration__sweep" />
      <div className="shipped-celebration__confetti">
        {confettiPieces.map((piece, index) => (
          <span key={index} className="shipped-celebration__confetti-piece" style={piece} />
        ))}
      </div>
      <div className="shipped-celebration__burst" />
      <div className="shipped-celebration__label">
        <span>{label}</span>
      </div>
    </div>
  );
}
