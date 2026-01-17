import type { TextareaHTMLAttributes } from 'react';
import './Textarea.css';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  className?: string;
}

export function Textarea({ className = '', ...props }: TextareaProps) {
  return (
    <textarea
      className={`textarea ${className}`}
      data-component="textarea"
      {...props}
    />
  );
}
