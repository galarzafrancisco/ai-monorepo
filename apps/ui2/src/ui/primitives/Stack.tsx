import type { ReactNode } from 'react';
import './Stack.css';

export interface StackProps {
  children: ReactNode;
  spacing?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
  align?: 'start' | 'center' | 'end' | 'stretch';
  className?: string;
}

export function Stack({
  children,
  spacing = '4',
  align = 'stretch',
  className = ''
}: StackProps) {
  return (
    <div
      className={`stack stack--spacing-${spacing} stack--align-${align} ${className}`}
      data-component="stack"
    >
      {children}
    </div>
  );
}
