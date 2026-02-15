import React, { useEffect, useRef, useState } from 'react';
import { PopShell } from '../../app/shells/PopShell';
import { Text } from '../../ui/primitives';
import './EditConcurrencyLimitPop.css';

type EditConcurrencyLimitPopProps = {
  initialValue: number | null;
  onCancel?: () => void;
  onSave: (payload: { concurrencyLimit: number | null }) => Promise<boolean>;
};

export function EditConcurrencyLimitPop({ initialValue, onCancel, onSave }: EditConcurrencyLimitPopProps) {
  const [value, setValue] = useState(initialValue !== null ? String(initialValue) : '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = async (): Promise<boolean> => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return onSave({ concurrencyLimit: null });
    }

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError('Use a whole number of 1 or higher, or leave empty for unlimited.');
      return false;
    }

    setError(null);
    return onSave({ concurrencyLimit: parsed });
  };

  return (
    <PopShell title="Edit Concurrency" onCancel={onCancel} onSave={handleSave}>
      <div className="edit-concurrency-limit-pop__content">
        <Text size="2" tone="muted">
          Leave empty for unlimited parallel tasks.
        </Text>
        <input
          ref={inputRef}
          className="edit-concurrency-limit-pop__input"
          type="number"
          min={1}
          step={1}
          placeholder="Unlimited"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) {
              setError(null);
            }
          }}
        />
        {error && (
          <Text size="1" className="edit-concurrency-limit-pop__error">
            {error}
          </Text>
        )}
      </div>
    </PopShell>
  );
}
