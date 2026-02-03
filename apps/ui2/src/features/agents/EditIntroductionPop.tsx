import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import "./EditIntroductionPop.css";

type EditIntroductionPopProps = {
  initialValue: string;
  onCancel?: () => void;
  onSave: (payload: { introduction: string }) => Promise<boolean>;
};

export function EditIntroductionPop({ initialValue, onCancel, onSave }: EditIntroductionPopProps) {
  const [content, setContent] = useState(initialValue);

  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  async function handleSave(): Promise<boolean> {
    return onSave({ introduction: content });
  }

  return (
    <PopShell
      title="Edit Introduction"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        <div className="edit-introduction-pop__input-content">
          <textarea
            className="edit-introduction-pop__input-content"
            ref={contentRef}
            placeholder="Enter introduction..."
            value={content}
            onChange={handleContentChange}
          />
        </div>
      </>
    </PopShell>
  );
}
