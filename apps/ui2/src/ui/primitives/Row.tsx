import type { ReactNode } from 'react';
import './Row.css';

export interface RowProps {
  children: ReactNode;
  spacing?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between';
  className?: string;
}

export function Row({
  children,
  spacing = '4',
  align = 'center',
  justify = 'start',
  className = ''
}: RowProps) {
  return (
    <div
      className={`row row--spacing-${spacing} row--align-${align} row--justify-${justify} ${className}`}
      data-component="row"
    >
      {children}
    </div>
  );
}
