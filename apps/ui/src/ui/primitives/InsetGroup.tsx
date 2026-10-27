import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import "./InsetGroup.css";

export interface InsetGroupProps {
  /** Small header above the group (iOS section header) */
  title?: ReactNode;
  /** Optional element on the right of the header, e.g. a text button */
  action?: ReactNode;
  /** Muted text under the group (iOS section footer) */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** iOS "inset grouped" list section: rounded card of rows with an optional header and footer. */
export function InsetGroup({ title, action, footer, children, className = "" }: InsetGroupProps) {
  return (
    <section className={`inset-group ${className}`}>
      {(title || action) && (
        <div className="inset-group__header">
          {title ? <h2 className="inset-group__title">{title}</h2> : <span />}
          {action ? <div className="inset-group__action">{action}</div> : null}
        </div>
      )}
      <div className="inset-group__card">{children}</div>
      {footer ? <div className="inset-group__footer">{footer}</div> : null}
    </section>
  );
}

export interface InsetRowProps {
  /** Icon or avatar on the left */
  leading?: ReactNode;
  /** Primary text */
  label?: ReactNode;
  /** Secondary text under the label */
  detail?: ReactNode;
  /** Value shown on the right, before the chevron */
  value?: ReactNode;
  /** Free content below the label (previews, chips) */
  children?: ReactNode;
  onClick?: () => void;
  /** Shows a disclosure chevron. Defaults to true when the row is clickable. */
  chevron?: boolean;
  /** accent = blue action row ("Add…"), danger = destructive action row */
  tone?: "default" | "accent" | "danger";
  /** Center the label (for standalone action rows) */
  centered?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function InsetRow({
  leading,
  label,
  detail,
  value,
  children,
  onClick,
  chevron,
  tone = "default",
  centered = false,
  disabled = false,
  className = "",
  title,
}: InsetRowProps) {
  const showChevron = chevron ?? (Boolean(onClick) && tone === "default");
  const classes = [
    "inset-row",
    `inset-row--${tone}`,
    onClick ? "inset-row--clickable" : "",
    centered ? "inset-row--centered" : "",
    leading ? "inset-row--has-leading" : "",
    className,
  ].join(" ");

  const body = (
    <>
      {leading ? <span className="inset-row__leading">{leading}</span> : null}
      <span className="inset-row__body">
        <span className="inset-row__top">
          {label ? <span className="inset-row__label">{label}</span> : null}
          {value !== undefined && value !== null ? <span className="inset-row__value">{value}</span> : null}
        </span>
        {detail ? <span className="inset-row__detail">{detail}</span> : null}
        {children ? <span className="inset-row__extra">{children}</span> : null}
      </span>
      {showChevron ? <ChevronRight className="inset-row__chevron" size={18} aria-hidden /> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} disabled={disabled} title={title}>
        {body}
      </button>
    );
  }

  return (
    <div className={classes} title={title}>
      {body}
    </div>
  );
}
