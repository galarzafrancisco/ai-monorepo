import "./ShippedCelebrationOverlay.css";

export function ShippedCelebrationOverlay(): JSX.Element {
  return (
    <div className="shipped-celebration" aria-hidden="true">
      <div className="shipped-celebration__veil" />
      <div className="shipped-celebration__rocket" aria-hidden="true">
        <span className="shipped-celebration__rocket-emoji">🚀</span>
        <span className="shipped-celebration__trail" />
      </div>
      <span className="shipped-celebration__spark shipped-celebration__spark--1" />
      <span className="shipped-celebration__spark shipped-celebration__spark--2" />
      <span className="shipped-celebration__spark shipped-celebration__spark--3" />
    </div>
  );
}
