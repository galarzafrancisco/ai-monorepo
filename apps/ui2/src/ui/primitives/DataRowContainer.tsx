import type { ReactNode } from "react";
import './DataRow.css';

export interface DataRowContainerProps {
  /** Main area: you can pass your own layout (stack of text rows etc.) */
  children: ReactNode;
  className?: string;
}

export function DataRowContainer({
  children,
  className,
}: DataRowContainerProps) {

  return (
    <div className={`data-row__container ${className}`}>
      {children}
    </div>
  );
}
