import { ReactNode } from "react";

export interface ChipProps {

  /** Main area: you can pass your own layout (stack of text rows etc.) */
  children: ReactNode;

  color?: "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple";

  className?: string;
}


export function Chip(props: ChipProps) {

  return (
    <span className={`chip chip--${props.color ?? "gray"}`}>
      {props.children}
    </span>
  )
}