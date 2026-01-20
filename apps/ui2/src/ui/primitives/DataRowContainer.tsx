import type { ReactNode } from "react";
import { Text } from '.';
import './DataRow.css';

export interface DataRowContainerProps {
  /** Main area: you can pass your own layout (stack of text rows etc.) */
  children: ReactNode;
  title?: string;
  className?: string;
}

export function DataRowContainer({
  children,
  title,
  className,
}: DataRowContainerProps) {

  return (
    <div className={`data-row__container ${className}`}>
      {title && <div style={{ paddingLeft: 'var(--space-3)' }}>
        <Text size="4" weight="bold">{title}</Text>
      </div>}
      {children}
    </div>
  );
}
