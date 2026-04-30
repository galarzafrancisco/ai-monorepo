import { type ReactNode } from "react";
import { Chip, type ChipProps } from "./Chip";
import "./DataRow.css";

export type DataRowTag = {
  label: string;
  color?: ChipProps["color"];
  onClick?: () => void;
  clickLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
};

export type DataRowAnimation = "entering" | "exiting";

export interface DataRowProps {
  /** Left area: icon / avatar / checkbox etc. */
  leading?: ReactNode;

  /** Main area: you can pass your own layout (stack of text rows etc.) */
  children: ReactNode;

  /** Chips under the text */
  tags?: DataRowTag[];

  /** Top-right meta, e.g. date / "Last updated" */
  topRight?: ReactNode;

  /** Optional supporting text on the right (like a chevron) */
  trailing?: ReactNode;

  /** Animation state for enter/exit transitions */
  animation?: DataRowAnimation;

  /** Click handler for the row */
  onClick?: (event: React.MouseEvent) => void;
  
  highlight?: boolean,

  className?: string;
}

export function DataRow({
  leading,
  children,
  tags = [],
  topRight,
  trailing,
  animation,
  onClick,
  highlight,
  className = "",
}: DataRowProps) {
  const animationClass = animation ? `data-row--${animation}` : "";
  const highlightClass = highlight ? "data-row--highlight": "";
  const clickClass = onClick ? "data-row--clickable" : "";

  const handleClick = (event: React.MouseEvent) => {
    onClick?.(event);
  };

  return (
    <div className={`data-row__wrapper ${animationClass}`} onClick={handleClick}>
      <div className={`data-row ${highlightClass} ${clickClass} ${className}`} data-component="data-row">

        {/* Leading */}
        {leading ? <div className="data-row__leading">{leading}</div> : null}

        {/* Content */}
        <div className="data-row__content">
          <div className="data-row__top">
            <div className={`data-row__main ${className}`}>{children}</div>
            {topRight ? <div className="data-row__meta">{topRight}</div> : null}
          </div>

          {tags.length ? (
            <div className="data-row__tags" aria-label="tags">
              {tags.map((t, index) => (
                <Chip
                  key={`${t.label}-${t.color ?? "gray"}-${index}`}
                  color={t.color}
                  onClick={t.onClick}
                  clickLabel={t.clickLabel ?? t.label}
                  onRemove={t.onRemove}
                  removeLabel={t.removeLabel ?? `Remove ${t.label}`}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>

        {/* Trailing */}
        {trailing ? <div className="data-row__trailing">{trailing}</div> : null}
      </div>
    </div>
  );
}
