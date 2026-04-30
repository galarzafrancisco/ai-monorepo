import { type CSSProperties, type ReactNode } from "react";
import "./Chip.css";

export interface ChipProps {
  /** Main area: you can pass your own layout (stack of text rows etc.) */
  children: ReactNode;

  color?: "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple";

  className?: string;

  style?: CSSProperties;

  onClick?: () => void;

  clickLabel?: string;

  onRemove?: () => void;

  removeLabel?: string;
}

export function Chip(props: ChipProps) {
  const chipClassName = [
    "chip",
    `chip--${props.color ?? "gray"}`,
    props.onClick ? "chip--clickable" : "",
    props.className ?? "",
  ].filter(Boolean).join(" ");

  if (props.onClick) {
    return (
      <button
        type="button"
        className={chipClassName}
        style={props.style}
        aria-label={props.clickLabel}
        onClick={(event) => {
          event.stopPropagation();
          props.onClick?.();
        }}
      >
        {props.children}
      </button>
    );
  }

  return (
    <span className={chipClassName} style={props.style}>
      {props.children}
      {props.onRemove ? (
        <button
          type="button"
          className="chip__remove"
          aria-label={props.removeLabel ?? `Remove ${props.children}`}
          onClick={(event) => {
            event.stopPropagation();
            props.onRemove?.();
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
