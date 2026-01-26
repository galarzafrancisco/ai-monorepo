import React, { useEffect, useRef } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { useDraftState } from "../../shared/hooks/useDraftState";
import "./NewCommentPop.css";

type AnswerInputRequestPopProps = {
  onCancel?: () => void;
  onSave: (payload: { answer: string }) => Promise<boolean>;
  taskId: string;
  inputRequestId: string;
  question: string;
};

interface AnswerDraftState {
  answer: string;
}

const defaultDraftState: AnswerDraftState = {
  answer: "",
};

export function AnswerInputRequestPop({ onCancel, onSave, taskId, inputRequestId, question }: AnswerInputRequestPopProps) {
  const [draftState, setDraftState, clearDraft] = useDraftState({
    key: `answer-input-request-draft-${inputRequestId}`,
    defaultValue: defaultDraftState,
  });

  const { answer } = draftState;

  const answerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    answerRef.current?.focus();
  }, []);

  function handleAnswerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraftState({ ...draftState, answer: e.target.value });
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  async function handleSave(): Promise<boolean> {
    const success = await onSave({ answer });
    if (success) {
      clearDraft();
    }
    return success;
  }

  return (
    <PopShell
      title="Answer Input Request"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        {/* Question */}
        <div className="new-comment-pop__input-content">
          <textarea
            className="new-comment-pop__input-content"
            value={question}
            readOnly
            style={{ opacity: 0.7, cursor: 'default' }}
          />
        </div>

        {/* Answer */}
        <div className="new-comment-pop__input-content">
          <textarea
            className="new-comment-pop__input-content"
            ref={answerRef}
            placeholder="Your answer..."
            value={answer}
            onChange={handleAnswerChange}
          />
        </div>
      </>
    </PopShell>
  );
}
