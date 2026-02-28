import { useEffect, useState, type ReactNode } from "react";
import "./DataRow.css";

export type DataRowTag = {
  label: string;
  color?: "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple";
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
  onClick?: () => void;
  
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

  return (
    <div className={`data-row__wrapper ${animationClass}`} onClick={onClick}>
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
              {tags.map((t, index) => {
                const chipClass = `chip chip--${t.color ?? "gray"}${t.onClick ? " chip--clickable" : ""}`;

                if (t.onClick) {
                  return (
                    <button
                      key={`${t.label}-${t.color ?? "gray"}-${index}`}
                      type="button"
                      className={chipClass}
                      aria-label={t.clickLabel ?? t.label}
                      onClick={(event) => {
                        event.stopPropagation();
                        t.onClick?.();
                      }}
                    >
                      {t.label}
                    </button>
                  );
                }

                return (
                  <span
                    key={`${t.label}-${t.color ?? "gray"}-${index}`}
                    className={chipClass}
                  >
                    {t.label}
                    {t.onRemove ? (
                      <button
                        type="button"
                        className="chip__remove"
                        aria-label={t.removeLabel ?? `Remove ${t.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          t.onRemove?.();
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Trailing */}
        {trailing ? <div className="data-row__trailing">{trailing}</div> : null}
      </div>
    </div>
  );
}
