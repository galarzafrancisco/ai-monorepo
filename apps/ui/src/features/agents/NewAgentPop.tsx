import React, { useEffect, useRef, useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import "./NewAgentPop.css";

type NewAgentPopProps = {
  onCancel?: () => void;
  onSave: (payload: { name: string; slug: string }) => Promise<boolean>;
};

export function NewAgentPop({ onCancel, onSave }: NewAgentPopProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const nameRef = useRef<HTMLInputElement | null>(null);
  const slugRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function handleSave(): Promise<boolean> {
    return onSave({ name, slug });
  }

  return (
    <PopShell
      title="Create an Agent"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        {/* Agent Display Name */}
        <div className="new-agent-pop__input-name">
          <input
            className="new-agent-pop__input-name"
            ref={nameRef}
            placeholder="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                slugRef.current?.focus();
              }
            }}
          />
        </div>

        {/* Agent Slug */}
        <div className="new-agent-pop__input-slug">
          <input
            className="new-agent-pop__input-slug"
            ref={slugRef}
            placeholder="Slug (e.g., my-agent)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
      </>
    </PopShell>
  );
}
