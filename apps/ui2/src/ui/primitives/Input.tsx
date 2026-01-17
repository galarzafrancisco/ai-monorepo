import type { InputHTMLAttributes } from 'react';
import './Input.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  className?: string;
}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`input ${className}`}
      data-component="input"
      {...props}
    />
  );
}
