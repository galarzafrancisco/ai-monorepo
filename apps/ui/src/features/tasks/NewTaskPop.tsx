import React, { useEffect, useRef } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { useDraftState } from "../../shared/hooks/useDraftState";
import "./NewTaskPop.css";

type NewTaskPopProps = {
  onCancel?: () => void;
  onSave: (payload: { title: string; description: string }) => Promise<boolean>;
};

interface TaskDraftState {
  title: string;
  description: string;
}

const defaultDraftState: TaskDraftState = {
  title: "",
  description: "",
};

const resizeTextarea = (el: HTMLTextAreaElement | null) => {
  if (!el) {
    return;
  }
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

export function NewTaskPop({ onCancel, onSave }: NewTaskPopProps) {
  const [draftState, setDraftState, clearDraft] = useDraftState({
    key: 'new-task-draft',
    defaultValue: defaultDraftState,
  });

  const { title, description } = draftState;

  const titleRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  const updateField = <K extends keyof TaskDraftState>(field: K, value: TaskDraftState[K]) => {
    setDraftState({ ...draftState, [field]: value });
  };

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    resizeTextarea(descriptionRef.current);
  }, [description]);

  function handleDescriptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    updateField('description', e.target.value);
    resizeTextarea(e.target);
  }

  async function handleSave(): Promise<boolean> {
    const success = await onSave({ title, description });
    if (success) {
      clearDraft(); // Clear draft on successful save
    }
    return success;
  }

  return (
    <PopShell
      title="Create a Task"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        {/* Task Title */}
        <div className="new-task-pop__input-title">
          <input
            className="new-task-pop__input-title"
            ref={titleRef}
            placeholder="Title"
            value={title}
            onChange={(e) => updateField('title', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                descriptionRef.current?.focus();
              }
            }}
          />
        </div>

        {/* Task Description */}
        <div className="new-task-pop__input-description">
          <textarea
            className="new-task-pop__input-description"
            ref={descriptionRef}
            placeholder="Enter a description (optional)"
            value={description}
            onChange={handleDescriptionChange}
          />

        </div>
      </>
    </PopShell>
  );
}
