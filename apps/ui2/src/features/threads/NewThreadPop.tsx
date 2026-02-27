import React, { useEffect, useRef } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { useDraftState } from "../../shared/hooks/useDraftState";
import "./NewThreadPop.css";

type NewThreadPopProps = {
  onCancel?: () => void;
  onSave: (payload: { title?: string }) => Promise<boolean>;
};

interface ThreadDraftState {
  title: string;
}

const defaultDraftState: ThreadDraftState = {
  title: "",
};

export function NewThreadPop({ onCancel, onSave }: NewThreadPopProps) {
  const [draftState, setDraftState, clearDraft] = useDraftState({
    key: 'new-thread-draft',
    defaultValue: defaultDraftState,
  });

  const { title } = draftState;

  const titleRef = useRef<HTMLInputElement | null>(null);

  const updateField = <K extends keyof ThreadDraftState>(field: K, value: ThreadDraftState[K]) => {
    setDraftState({ ...draftState, [field]: value });
  };

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function handleSave(): Promise<boolean> {
    const success = await onSave({ title: title.trim() || undefined });
    if (success) {
      clearDraft(); // Clear draft on successful save
    }
    return success;
  }

  return (
    <PopShell
      title="Create a Thread"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        {/* Thread Title */}
        <div className="new-thread-pop__input-title">
          <input
            className="new-thread-pop__input-title"
            ref={titleRef}
            placeholder="Thread title (optional)"
            value={title}
            onChange={(e) => updateField('title', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        </div>
      </>
    </PopShell>
  );
}
