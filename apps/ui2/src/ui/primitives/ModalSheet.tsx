import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ModalSheet.css';

export interface ModalSheetAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ModalSheetProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  primaryAction?: ModalSheetAction;
  secondaryAction?: ModalSheetAction;
  onClose?: () => void;
}

export function ModalSheet({
  isOpen,
  title,
  children,
  primaryAction,
  secondaryAction,
  onClose,
}: ModalSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="modal-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-sheet__backdrop" onClick={onClose} />
      <div className="modal-sheet__panel">
        <div className="modal-sheet__grab-handle" aria-hidden="true" />
        <header className="modal-sheet__header">
          {secondaryAction ? (
            <button
              type="button"
              className="modal-sheet__header-btn modal-sheet__header-btn--ghost"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.label}
            </button>
          ) : (
            <span />
          )}
          <span className="modal-sheet__title">{title}</span>
          {primaryAction ? (
            <button
              type="button"
              className="modal-sheet__header-btn"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>
          ) : (
            <span />
          )}
        </header>
        <div className="modal-sheet__body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
