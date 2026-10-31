import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import "./EditPromptPop.css";

type EditPromptPopProps = {
  title: string;
  placeholder: string;
  initialValue: string;
  onCancel?: () => void;
  onSave: (content: string) => Promise<boolean>;
};

const resizeTextarea = (el: HTMLTextAreaElement | null) => {
  if (!el) {
    return;
  }
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

export function EditPromptPop({ title, placeholder, initialValue, onCancel, onSave }: EditPromptPopProps) {
  const [content, setContent] = useState(initialValue);

  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  useEffect(() => {
    resizeTextarea(contentRef.current);
  }, [content]);

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    resizeTextarea(e.target);
  }

  return (
    <PopShell
      title={title}
      onCancel={onCancel}
      onSave={() => onSave(content)}
    >
      <div className="edit-prompt-pop__input-wrapper">
        <textarea
          className="edit-prompt-pop__input-content"
          ref={contentRef}
          placeholder={placeholder}
          value={content}
          onChange={handleContentChange}
        />
      </div>
    </PopShell>
  );
}
