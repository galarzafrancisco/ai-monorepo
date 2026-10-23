import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Text } from "../../ui/primitives";
import { ThreadsService } from "./api";
import "./EditableThreadTitle.css";

interface EditableThreadTitleProps {
  threadId: string;
  title: string;
  /** Called after the new title has been saved. */
  onRenamed: (title: string) => void;
}

/** Thread title that turns into an input when clicked. Enter saves, Escape cancels. */
export function EditableThreadTitle({ threadId, title, onRenamed }: EditableThreadTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(title);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    if (savingRef.current) return;
    const next = draft.trim();
    if (!next || next === title) {
      cancel();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await ThreadsService.ThreadsController_updateThread({ id: threadId, body: { title: next } });
      onRenamed(next);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename thread");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="editable-thread-title editable-thread-title--editing">
        <input
          ref={inputRef}
          className="editable-thread-title__input"
          aria-label="Thread title"
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
        />
        {error && (
          <Text size="1" tone="muted" className="editable-thread-title__error">
            {error}
          </Text>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="editable-thread-title"
      onClick={startEditing}
      title="Click to rename"
    >
      <Text size="5" weight="bold" className="editable-thread-title__text">
        {title}
      </Text>
      <Pencil size={14} className="editable-thread-title__icon" aria-hidden="true" />
    </button>
  );
}
