import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import "./EditToolNamePop.css";

type EditToolNamePopProps = {
  initialValue: string;
  onCancel?: () => void;
  onSave: (payload: { name: string }) => Promise<boolean>;
};

export function EditToolNamePop({ initialValue, onCancel, onSave }: EditToolNamePopProps) {
  const [name, setName] = useState(initialValue);

  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function handleSave(): Promise<boolean> {
    if (!name.trim()) {
      return false;
    }
    return onSave({ name: name.trim() });
  }

  return (
    <PopShell
      title="Edit Tool Name"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        <div className="edit-tool-name-pop__input-wrapper">
          <input
            type="text"
            className="edit-tool-name-pop__input"
            ref={nameRef}
            placeholder="Enter tool name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </>
    </PopShell>
  );
}
