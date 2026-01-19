import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import "./NewTaskPop.css";

type NewTaskPopProps = {
  onCancel?: () => void;
  onSave: (payload: { title: string; description: string }) => Promise<boolean>;
};

export function NewTaskPop({ onCancel, onSave }: NewTaskPopProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const titleRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function handleDescriptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDescription(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  async function handleSave(): Promise<boolean> {
    return onSave({ title, description });
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
            onChange={(e) => setTitle(e.target.value)}
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
