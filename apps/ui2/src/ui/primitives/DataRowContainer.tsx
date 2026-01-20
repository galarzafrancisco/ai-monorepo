import type { ReactNode } from "react";
import { Text } from '.';
import './DataRowContainer.css';

export interface DataRowContainerProps {
  /** Main area: you can pass your own layout (stack of text rows etc.) */
  children: ReactNode;
  title?: string;
  className?: string;
  /** Optional action element (e.g., a button) shown in the header */
  action?: ReactNode;
}

export function DataRowContainer({
  children,
  title,
  className,
  action,
}: DataRowContainerProps) {

  return (
    <div className={`data-row__container ${className}`}>
      {(title || action) && (
        <div className="data-row__container-header">
          {title && <Text size="4" weight="bold">{title}</Text>}
          {action && <div className="data-row__container-action">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
