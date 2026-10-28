import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './Modal.css';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Extra class on the dialog, e.g. to size it. */
  className?: string;
  children: ReactNode;
}

/** Centered dialog over a dimmed page. Closes on Escape or a click outside. */
export function Modal({ open, onOpenChange, title, description, className, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal__overlay" />
        <Dialog.Content
          className={className ? `modal__content ${className}` : 'modal__content'}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <Dialog.Title className="modal__title">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="modal__description">{description}</Dialog.Description>
          ) : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
