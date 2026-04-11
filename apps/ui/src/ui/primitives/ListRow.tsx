import type { ReactNode } from 'react';
import './ListRow.css';

export interface ListRowProps {
  children: ReactNode;
  onClick?: () => void;
  interactive?: boolean;
  className?: string;
}

export function ListRow({
  children,
  onClick,
  interactive = false,
  className = ''
}: ListRowProps) {
  const isInteractive = interactive || !!onClick;

  return (
    <div
      className={`list-row ${isInteractive ? 'list-row--interactive' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-component="list-row"
    >
      {children}
    </div>
  );
}
