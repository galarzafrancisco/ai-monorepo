import { useEffect, useState, type ReactNode } from "react";
import "./BoardCard.css";

export type CardTag = {
  label: string;
  color?: "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple";
};

export type BoardCardAnimation = "entering" | "exiting";

export interface BoardCardProps {
  /** Top-left: avatar / icon / priority flag etc. */
  leading?: ReactNode;

  /** Main content: title/desc/whatever */
  children: ReactNode;

  /** Chips under content */
  tags?: CardTag[];

  /** Top-right meta (date, points, etc.) */
  topRight?: ReactNode;

  /** Bottom row (assignee, stats, etc.) */
  footer?: ReactNode;

  /** Optional right-side actions (kebab, etc.) */
  trailing?: ReactNode;

  /** Animation state for enter/exit transitions */
  animation?: BoardCardAnimation;

  pulseKey?: number;
  highlight?: boolean;

  /** Click handler for the row */
  onClick?: (event: React.MouseEvent) => void;

  className?: string;
}

export function BoardCard({
  leading,
  children,
  tags = [],
  topRight,
  footer,
  trailing,
  animation,
  onClick,
  className = "",
  pulseKey,
  highlight,
}: BoardCardProps) {

  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (pulseKey == null) return;

    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600); // match CSS duration
    return () => clearTimeout(t);
  }, [pulseKey]);

  const animationClass = animation ? `board-card--${animation}` : "";
  const pulseClass = pulse ? "board-card--eventPulse" : "";
  const highlightClass = highlight ? "board-card--highlight": "";

  const handleClick = (event: React.MouseEvent) => {
    onClick?.(event);
  };

  return (
    <div className={`board-card__wrapper ${animationClass}`} onClick={handleClick}>
      <div className={`board-card ${highlightClass} ${pulseClass} ${className}`} data-component="board-card">
        <div className="board-card__header">
          <div className="board-card__headerLeft">
            {leading ? <div className="board-card__leading">{leading}</div> : null}
          </div>

          <div className="board-card__headerRight">
            {topRight ? <div className="board-card__meta">{topRight}</div> : null}
            {trailing ? <div className="board-card__trailing">{trailing}</div> : null}
          </div>
        </div>

        <div className="board-card__main">{children}</div>

        {tags.length ? (
          <div className="board-card__tags" aria-label="tags">
            {tags.map((t) => (
              <span key={t.label} className={`chip chip--${t.color ?? "gray"}`}>
                {t.label}
              </span>
            ))}
          </div>
        ) : null}

        {footer ? <div className="board-card__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
