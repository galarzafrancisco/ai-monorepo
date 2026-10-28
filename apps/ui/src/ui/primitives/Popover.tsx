import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Popover.css';

export interface PopoverProps {
  /** What the popover is about; rendered inside the trigger button. */
  trigger: ReactNode;
  /** Accessible name of the trigger when its content is only an icon. */
  triggerLabel?: string;
  className?: string;
  triggerClassName?: string;
  children: ReactNode;
}

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 120;
const GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;

/**
 * A small card anchored to a trigger. Opens on hover or keyboard focus where
 * there is a mouse, and toggles on tap where there is not; closes on Escape,
 * a click outside, or the pointer leaving both trigger and card.
 *
 * Rendered in a portal with fixed positioning so scrolling containers (board
 * columns, sidebars) never clip it.
 */
export function Popover({ trigger, triggerLabel, className, triggerClassName, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const pointerOverCard = useRef(false);
  const id = useId();

  const schedule = useCallback((next: boolean) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), next ? OPEN_DELAY_MS : CLOSE_DELAY_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const card = cardRef.current?.getBoundingClientRect();
      if (!anchor || !card) return;
      const fitsBelow = anchor.bottom + GAP_PX + card.height <= window.innerHeight - VIEWPORT_MARGIN_PX;
      const top = fitsBelow ? anchor.bottom + GAP_PX : Math.max(VIEWPORT_MARGIN_PX, anchor.top - GAP_PX - card.height);
      const maxLeft = window.innerWidth - card.width - VIEWPORT_MARGIN_PX;
      const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(anchor.left, maxLeft));
      setPosition({ top, left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !cardRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      // The card is gone, so it gets no pointerleave.
      pointerOverCard.current = false;
    };
  }, [open]);

  const hoverHandlers = {
    onPointerEnter: (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse') schedule(true);
    },
    onPointerLeave: (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse') schedule(false);
    },
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ? `popover__trigger ${triggerClassName}` : 'popover__trigger'}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          // Inside clickable rows and cards the trigger must not also open the row.
          event.stopPropagation();
          event.preventDefault();
          window.clearTimeout(timer.current);
          setOpen((current) => !current);
        }}
        onFocus={(event) => {
          if (event.target.matches(':focus-visible')) schedule(true);
        }}
        onBlur={(event) => {
          // Pressing inside the card takes focus off the trigger; closing then would
          // remove the card before the click lands on its links.
          const next = event.relatedTarget as Node | null;
          if (pointerOverCard.current || (next && cardRef.current?.contains(next))) return;
          schedule(false);
        }}
        {...hoverHandlers}
      >
        {trigger}
      </button>
      {open
        ? createPortal(
            <div
              ref={cardRef}
              id={id}
              role="dialog"
              className={className ? `popover__card ${className}` : 'popover__card'}
              style={position ? { top: position.top, left: position.left } : { visibility: 'hidden', top: 0, left: 0 }}
              onClick={(event) => event.stopPropagation()}
              onPointerEnter={(event) => {
                pointerOverCard.current = true;
                hoverHandlers.onPointerEnter(event);
              }}
              onPointerLeave={(event) => {
                pointerOverCard.current = false;
                hoverHandlers.onPointerLeave(event);
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
