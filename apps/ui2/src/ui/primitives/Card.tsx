import type { ReactNode } from 'react';
import './Card.css';

export interface CardProps {
  children: ReactNode;
  padding?: '2' | '3' | '4' | '5' | '6';
  className?: string;
}

export function Card({
  children,
  padding = '4',
  className = ''
}: CardProps) {
  return (
    <div
      className={`card card--padding-${padding} ${className}`}
      data-component="card"
    >
      {children}
    </div>
  );
}
