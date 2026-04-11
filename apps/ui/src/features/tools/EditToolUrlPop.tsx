import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import "./EditToolUrlPop.css";

type EditToolUrlPopProps = {
  initialValue: string;
  onCancel?: () => void;
  onSave: (payload: { url: string }) => Promise<boolean>;
};

export function EditToolUrlPop({ initialValue, onCancel, onSave }: EditToolUrlPopProps) {
  const [url, setUrl] = useState(initialValue);

  const urlRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  async function handleSave(): Promise<boolean> {
    if (!url.trim()) {
      return false;
    }
    return onSave({ url: url.trim() });
  }

  return (
    <PopShell
      title="Edit Server URL"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        <div className="edit-tool-url-pop__input-wrapper">
          <input
            type="url"
            className="edit-tool-url-pop__input"
            ref={urlRef}
            placeholder="https://example.com/mcp"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      </>
    </PopShell>
  );
}
