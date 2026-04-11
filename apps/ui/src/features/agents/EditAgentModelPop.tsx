import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import "./EditAgentModelPop.css";

type EditAgentModelPopProps = {
  initialProviderId: string;
  initialModelId: string;
  onCancel?: () => void;
  onSave: (payload: { providerId: string; modelId: string }) => Promise<boolean>;
};

export function EditAgentModelPop({
  initialProviderId,
  initialModelId,
  onCancel,
  onSave,
}: EditAgentModelPopProps) {
  const [providerId, setProviderId] = useState(initialProviderId);
  const [modelId, setModelId] = useState(initialModelId);

  const providerRef = useRef<HTMLInputElement | null>(null);
  const modelRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    providerRef.current?.focus();
  }, []);

  async function handleSave(): Promise<boolean> {
    return onSave({
      providerId: providerId.trim(),
      modelId: modelId.trim(),
    });
  }

  return (
    <PopShell title="Edit Model" onCancel={onCancel} onSave={handleSave}>
      <>
        <div className="edit-agent-model-pop__field">
          <input
            className="edit-agent-model-pop__input"
            ref={providerRef}
            placeholder="Provider ID (optional)"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                modelRef.current?.focus();
              }
            }}
          />
        </div>
        <div className="edit-agent-model-pop__field">
          <input
            className="edit-agent-model-pop__input"
            ref={modelRef}
            placeholder="Model ID (optional)"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          />
        </div>
      </>
    </PopShell>
  );
}
