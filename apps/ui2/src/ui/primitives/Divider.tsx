import './Divider.css';

export interface DividerProps {
  spacing?: '2' | '3' | '4' | '5' | '6';
  className?: string;
}

export function Divider({
  spacing = '4',
  className = ''
}: DividerProps) {
  return (
    <hr
      className={`divider divider--spacing-${spacing} ${className}`}
      data-component="divider"
    />
  );
}
