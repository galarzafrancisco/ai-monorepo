import { useCallback, useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, PanelRightClose, type LucideIcon } from 'lucide-react';
import './ContextRail.css';

export interface ContextRailProps {
  children: ReactNode;
  /** Shown in the header when open and down the strip when collapsed, e.g. "Details" or "Runs". */
  title: string;
  /** Marks the collapsed strip so it reads at a glance. */
  icon: LucideIcon;
  /** Shown muted after the title, e.g. 3. */
  count?: ReactNode;
  /** Something is happening in here right now (e.g. a live run): a green dot beside the title. */
  live?: boolean;
  /** Extra header controls, before the collapse button. */
  actions?: ReactNode;
  open?: boolean;
  /** Omit to leave out the collapse controls. */
  onOpenChange?: (open: boolean) => void;
  /** Off for content that manages its own scrolling (e.g. a log that follows new output). */
  scroll?: boolean;
  className?: string;
}

/**
 * The right-hand panel on detail pages: full height, flush to the window edge,
 * with a header naming it. Collapses to a slim strip that opens it again.
 */
export function ContextRail({
  children,
  title,
  icon: Icon,
  count,
  live = false,
  actions,
  open = true,
  onOpenChange,
  scroll = true,
  className = '',
}: ContextRailProps) {
  const bodyId = useId();
  const countText = count !== undefined && count !== null ? count : null;

  if (!open && onOpenChange) {
    return (
      <aside className={`context-rail context-rail--collapsed ${className}`} aria-label={title}>
        <button
          type="button"
          className="context-rail__strip"
          onClick={() => onOpenChange(true)}
          aria-expanded={false}
          title={`Open ${title.toLowerCase()}`}
        >
          <Icon size={18} aria-hidden="true" />
          <span className="context-rail__strip-label">{title}</span>
          {countText !== null && <span className="context-rail__strip-count">{countText}</span>}
          {live && <span className="context-rail__live" aria-label="Live" />}
        </button>
      </aside>
    );
  }

  return (
    <aside className={`context-rail ${className}`} aria-label={title}>
      <header className="context-rail__header">
        <h2 className="context-rail__title">
          {title}
          {countText !== null && <span className="context-rail__count"> · {countText}</span>}
          {live && <span className="context-rail__live" aria-label="Live" />}
        </h2>
        <div className="context-rail__actions">
          {actions}
          {onOpenChange && (
            <button
              type="button"
              className="context-rail__icon-button"
              onClick={() => onOpenChange(false)}
              aria-expanded={true}
              aria-controls={bodyId}
              aria-label={`Close ${title.toLowerCase()}`}
              title="Close"
            >
              <PanelRightClose size={16} />
            </button>
          )}
        </div>
      </header>
      <div id={bodyId} className={scroll ? 'context-rail__scroll thin-scrollbar' : 'context-rail__fill'}>
        {children}
      </div>
    </aside>
  );
}

/** Open/closed state for a rail, remembered per browser under `storageKey`. */
export function useRailOpen(storageKey: string, defaultOpen: boolean, legacyOpenValues: string[] = []) {
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) return defaultOpen;
      return stored === 'open' || legacyOpenValues.includes(stored);
    } catch {
      return defaultOpen;
    }
  });
  const change = useCallback((next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(storageKey, next ? 'open' : 'closed'); } catch { /* Storage may be unavailable. */ }
  }, [storageKey]);
  return [open, change] as const;
}

export interface RailSectionProps {
  title: string;
  /** Shown muted after the title, e.g. "2 agents" or 3. */
  count?: ReactNode;
  /** Small control on the header's right, e.g. a link to the full view. */
  action?: ReactNode;
  /** Lets the header fold the section away. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Controlled folding, for callers that keep it themselves. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Pins the section to the bottom of the rail (e.g. destructive actions). */
  footer?: boolean;
  children: ReactNode;
}

export function RailSection({
  title,
  count,
  action,
  collapsible = false,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  footer = false,
  children,
}: RailSectionProps) {
  const [ownCollapsed, setOwnCollapsed] = useState(defaultCollapsed);
  const collapsed = collapsible && (controlledCollapsed ?? ownCollapsed);
  const bodyId = useId();

  const toggle = () => {
    const next = !collapsed;
    setOwnCollapsed(next);
    onCollapsedChange?.(next);
  };

  const heading = (
    <>
      <span className="rail-section__title">{title}</span>
      {count !== undefined && count !== null && <span className="rail-section__count"> · {count}</span>}
    </>
  );

  return (
    <section className={`rail-section${footer ? ' rail-section--footer' : ''}`}>
      {!footer && (
        <header className="rail-section__header">
          {collapsible ? (
            <button
              type="button"
              className="rail-section__toggle"
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              onClick={toggle}
            >
              {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              {heading}
            </button>
          ) : (
            <h3 className="rail-section__heading">{heading}</h3>
          )}
          {action && <div className="rail-section__action">{action}</div>}
        </header>
      )}
      {!collapsed && <div id={bodyId} className="rail-section__body">{children}</div>}
    </section>
  );
}
