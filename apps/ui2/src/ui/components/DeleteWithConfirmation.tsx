import { useState } from 'react';
import { Button, DataRowContainer } from '../primitives';

export type DeleteWithConfirmationProps = {
  /**
   * Callback when delete is confirmed
   */
  onDelete: () => void | Promise<void>;
  /**
   * Optional custom label for the delete button (default: "Delete")
   */
  deleteLabel?: string;
  /**
   * Optional custom label for the confirm button (default: "Confirm Delete")
   */
  confirmLabel?: string;
  /**
   * Optional custom label for the cancel button (default: "Cancel")
   */
  cancelLabel?: string;
  /**
   * Optional className for the container
   */
  className?: string;
  /**
   * Button size (default: 'lg')
   */
  size?: 'sm' | 'md' | 'lg';
};

/**
 * A reusable component that implements a two-step delete pattern.
 * First click shows the delete button, second click shows confirmation buttons.
 */
export function DeleteWithConfirmation({
  onDelete,
  deleteLabel = 'Delete',
  confirmLabel = 'Confirm Delete',
  cancelLabel = 'Cancel',
  className,
  size = 'lg',
}: DeleteWithConfirmationProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    await onDelete();
    setShowConfirm(false);
  };

  return (
    <DataRowContainer className={className}>
      {!showConfirm ? (
        <Button
          size={size}
          variant="danger"
          onClick={() => setShowConfirm(true)}
        >
          {deleteLabel}
        </Button>
      ) : (
        <>
          <Button
            size={size}
            variant="secondary"
            onClick={() => setShowConfirm(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            size={size}
            variant="danger"
            onClick={handleDelete}
          >
            {confirmLabel}
          </Button>
        </>
      )}
    </DataRowContainer>
  );
}
