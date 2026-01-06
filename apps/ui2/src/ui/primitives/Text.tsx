import type { ReactNode } from 'react';
import './Text.css';

export interface TextProps {
  children: ReactNode;
  size?: '1' | '2' | '3' | '4' | '5' | '6';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  tone?: 'default' | 'muted' | 'inverse';
  as?: 'p' | 'span' | 'div' | 'label';
  className?: string;
}

export function Text({
  children,
  size = '2',
  weight = 'normal',
  tone = 'default',
  as: Component = 'p',
  className = ''
}: TextProps) {
  return (
    <Component
      className={`text text--size-${size} text--weight-${weight} text--tone-${tone} ${className}`}
      data-component="text"
    >
      {children}
    </Component>
  );
}
