import React, { useEffect, useRef } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { useDraftState } from "../../shared/hooks/useDraftState";
import "./NewCommentPop.css";

type NewCommentPopProps = {
  onCancel?: () => void;
  onSave: (payload: { content: string }) => Promise<boolean>;
  taskId: string;
};

interface CommentDraftState {
  content: string;
}

const defaultDraftState: CommentDraftState = {
  content: "",
};

const resizeTextarea = (el: HTMLTextAreaElement | null) => {
  if (!el) {
    return;
  }
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

export function NewCommentPop({ onCancel, onSave, taskId }: NewCommentPopProps) {
  const [draftState, setDraftState, clearDraft] = useDraftState({
    key: `new-comment-draft-${taskId}`,
    defaultValue: defaultDraftState,
  });

  const { content } = draftState;

  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  useEffect(() => {
    resizeTextarea(contentRef.current);
  }, [content]);

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraftState({ ...draftState, content: e.target.value });
    resizeTextarea(e.target);
  }

  async function handleSave(): Promise<boolean> {
    const success = await onSave({ content });
    if (success) {
      clearDraft();
    }
    return success;
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
