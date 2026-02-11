import React, { useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { AgentResponseDto } from "@taico/client";
import { Text } from "../../ui/primitives";
import "./EditAgentTypePop.css";

type EditAgentTypePopProps = {
  initialValue: AgentResponseDto.type;
  onCancel?: () => void;
  onSave: (payload: { type: AgentResponseDto.type }) => Promise<boolean>;
};

const AGENT_TYPES = [
  { value: AgentResponseDto.type.CLAUDE, label: "Claude", description: "Anthropic's Claude AI" },
  { value: AgentResponseDto.type.CODEX, label: "Codex", description: "OpenAI's Codex" },
  { value: AgentResponseDto.type.OPENCODE, label: "OpenCode", description: "OpenCode agent" },
  { value: AgentResponseDto.type.ADK, label: "ADK", description: "Agent Development Kit" },
  { value: AgentResponseDto.type.GITHUBCOPILOT, label: "GitHub Copilot", description: "GitHub Copilot agent" },
  { value: AgentResponseDto.type.OTHER, label: "Other", description: "Other agent type" },
];

export function EditAgentTypePop({ initialValue, onCancel, onSave }: EditAgentTypePopProps) {
  const [selectedType, setSelectedType] = useState<AgentResponseDto.type>(initialValue);

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
