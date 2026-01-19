import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import "./NewCommentPop.css";

type NewCommentPopProps = {
  onCancel?: () => void;
  onSave: (payload: { content: string }) => Promise<boolean>;
};

export function NewCommentPop({ onCancel, onSave }: NewCommentPopProps) {
  const [content, setContent] = useState("");

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
    return onSave({ content });
  }

  return (
    <PopShell
      title="Add Comment"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        {/* Comment */}
        <div className="new-comment-pop__input-content">
          <textarea
            className="new-comment-pop__input-content"
            ref={contentRef}
            placeholder="Leave a comment..."
            value={content}
            onChange={handleContentChange}
          />

        </div>
      </>
    </PopShell>
  );
}
