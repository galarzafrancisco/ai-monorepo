import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import "./EditToolDescriptionPop.css";

type EditToolDescriptionPopProps = {
  initialValue: string;
  onCancel?: () => void;
  onSave: (payload: { description: string }) => Promise<boolean>;
};

const resizeTextarea = (el: HTMLTextAreaElement | null) => {
  if (!el) {
    return;
  }
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

export function EditToolDescriptionPop({ initialValue, onCancel, onSave }: EditToolDescriptionPopProps) {
  const [description, setDescription] = useState(initialValue);

  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    descriptionRef.current?.focus();
  }, []);

  useEffect(() => {
    resizeTextarea(descriptionRef.current);
  }, [description]);

  function handleDescriptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDescription(e.target.value);
    resizeTextarea(e.target);
  }

  async function handleSave(): Promise<boolean> {
    return onSave({ description });
  }

  return (
    <PopShell
      title="Edit Tool Description"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        <div className="edit-tool-description-pop__input-wrapper">
          <textarea
            className="edit-tool-description-pop__input"
            ref={descriptionRef}
            placeholder="Enter description..."
            value={description}
            onChange={handleDescriptionChange}
          />
        </div>
      </>
    </PopShell>
  );
}
