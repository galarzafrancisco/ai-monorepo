import type { ReactNode } from "react";
import "./DataRow.css";

export type DataRowTag = {
  label: string;
  color?: "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple";
};

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

  className?: string;
}

export function DataRow({
  leading,
  children,
  tags = [],
  topRight,
  trailing,
  className = "",
}: DataRowProps) {
  return (
    <div className={`data-row ${className}`} data-component="data-row">
      {leading ? <div className="data-row__leading">{leading}</div> : null}

      <div className="data-row__content">
        <div className="data-row__top">
          <div className="data-row__main">{children}</div>
          {topRight ? <div className="data-row__meta">{topRight}</div> : null}
        </div>

        {tags.length ? (
          <div className="data-row__tags" aria-label="tags">
            {tags.map((t) => (
              <span
                key={t.label}
                className={`chip chip--${t.color ?? "gray"}`}
              >
                {t.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {trailing ? <div className="data-row__trailing">{trailing}</div> : null}
    </div>
  );
}
