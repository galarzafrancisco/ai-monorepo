import './Switch.css';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name; use when no visible label points at the switch. */
  label?: string;
  id?: string;
  disabled?: boolean;
}

/** An on/off toggle that takes effect straight away. */
export function Switch({ checked, onCheckedChange, label, id, disabled }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch"
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="switch__thumb" aria-hidden="true" />
    </button>
  );
}
