import './ShippedCelebrationOverlay.css';

type ShippedCelebrationOverlayProps = {
  label?: string;
};

export function ShippedCelebrationOverlay({ label = 'Shipped' }: ShippedCelebrationOverlayProps) {
  return (
    <div className="shipped-celebration" aria-hidden="true">
      <div className="shipped-celebration__backdrop" />
      <div className="shipped-celebration__sweep" />
      <div className="shipped-celebration__burst" />
      <div className="shipped-celebration__label">
        <span>{label}</span>
      </div>
    </div>
  );
}
