import { ReactNode } from "react";
import "./Chip.css";

export interface ChipProps {

  /** Main area: you can pass your own layout (stack of text rows etc.) */
  children: ReactNode;

  color?: "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple";

  className?: string;

  /** Optional remove handler. When provided, shows an 'x' button */
  onRemove?: () => void;
}


export function Chip(props: ChipProps) {

  return (
    <span className={`chip chip--${props.color ?? "gray"} ${props.onRemove ? 'chip--removable' : ''}`}>
      {props.children}
      {props.onRemove && (
        <button
          className="chip__remove"
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove?.();
          }}
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </span>
  )
}