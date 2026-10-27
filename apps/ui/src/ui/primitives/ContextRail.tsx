import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react';
import './ContextRail.css';

export interface ContextRailProps {
  children: ReactNode;
  /** Names the rail for assistive tech, e.g. "Thread details". */
  label: string;
  open?: boolean;
  /** Omit to leave out the collapse toggle. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * The right-hand rail on detail pages: full height, flush to the window edge,
 * holding context about the thing in the main column as a stack of sections.
 * Collapses to a slim strip.
 */
export function ContextRail({ children, label, open = true, onOpenChange, className = '' }: ContextRailProps) {
  return (
    <aside className={`context-rail${open ? '' : ' context-rail--collapsed'} ${className}`} aria-label={label}>
      {open && <div className="context-rail__scroll thin-scrollbar">{children}</div>}
      {onOpenChange && <button
        type="button"
        className="context-rail__toggle"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? `Collapse ${label.toLowerCase()}` : `Expand ${label.toLowerCase()}`}
        title={open ? 'Collapse' : 'Expand'}
      >
        {open ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
      </button>}
    </aside>
  );
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
            <h2 className="rail-section__heading">{heading}</h2>
          )}
          {action && <div className="rail-section__action">{action}</div>}
        </header>
      )}
      {!collapsed && <div id={bodyId} className="rail-section__body">{children}</div>}
    </section>
  );
}
