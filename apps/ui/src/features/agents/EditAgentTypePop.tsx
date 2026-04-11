import React, { useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import type { AgentResponseDto } from "@taico/client/v2";
import { Text } from "../../ui/primitives";
import "./EditAgentTypePop.css";

type AgentType = AgentResponseDto['type'];

type EditAgentTypePopProps = {
  initialValue: AgentType;
  onCancel?: () => void;
  onSave: (payload: { type: AgentType }) => Promise<boolean>;
};

const AGENT_TYPES: Array<{ value: AgentType; label: string; description: string }> = [
  { value: 'claude' as const, label: "Claude", description: "Anthropic's Claude AI" },
  { value: 'codex' as const, label: "Codex", description: "OpenAI's Codex" },
  { value: 'opencode' as const, label: "OpenCode", description: "OpenCode agent" },
  { value: 'adk' as const, label: "ADK", description: "Agent Development Kit" },
  { value: 'githubcopilot' as const, label: "GitHub Copilot", description: "GitHub Copilot agent" },
  { value: 'other' as const, label: "Other", description: "Other agent type" },
];

export function EditAgentTypePop({ initialValue, onCancel, onSave }: EditAgentTypePopProps) {
  const [selectedType, setSelectedType] = useState<AgentType>(initialValue);

  async function handleSave(): Promise<boolean> {
    return onSave({ type: selectedType });
  }

  return (
    <PopShell
      title="Edit Agent Type"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="edit-agent-type-pop__content">
        <Text size="2" tone="muted" className="edit-agent-type-pop__description">
          Select the type of agent (provider). An agent can only be of one type.
        </Text>
        <div className="edit-agent-type-pop__radio-list">
          {AGENT_TYPES.map((type) => (
            <label
              key={type.value}
              className="edit-agent-type-pop__radio-item"
            >
              <input
                type="radio"
                name="agent-type"
                value={type.value}
                checked={selectedType === type.value}
                onChange={() => setSelectedType(type.value)}
                className="edit-agent-type-pop__radio"
              />
              <div className="edit-agent-type-pop__type-info">
                <Text size="3" weight="medium">
                  {type.label}
                </Text>
                <Text size="2" tone="muted">
                  {type.description}
                </Text>
              </div>
            </label>
          ))}
        </div>
      </div>
    </PopShell>
  );
}
