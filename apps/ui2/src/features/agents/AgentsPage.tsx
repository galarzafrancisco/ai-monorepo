import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, DataRow, Text, DataRowContainer, DataRowTag } from "../../ui/primitives";
import { useAgentsCtx } from "./AgentsProvider";
import { Agent } from "./types";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { AgentResponseDto } from "shared";

export function AgentsPage() {
  const { agents, setSectionTitle, isLoading, error } = useAgentsCtx();
  const navigate = useNavigate();

  // Set page title
  useEffect(() => {
    setSectionTitle("All Agents");
  }, [setSectionTitle]);

  if (isLoading && agents.length === 0) {
    return (
      <DataRowContainer>
        <DataRow leading={<Avatar name="..." size="lg" />}>
          <Text tone="muted">Loading agents...</Text>
        </DataRow>
      </DataRowContainer>
    );
  }

  if (error) {
    return (
      <DataRowContainer>
        <DataRow leading={<Avatar name="!" size="lg" />}>
          <Text tone="muted">Error: {error}</Text>
        </DataRow>
      </DataRowContainer>
    );
  }

  if (agents.length === 0) {
    return (
      <DataRowContainer>
        <DataRow leading={<Avatar name="?" size="lg" />}>
          <Text tone="muted">No agents found</Text>
        </DataRow>
      </DataRowContainer>
    );
  }

  return (
    <DataRowContainer>
      {agents.map(agent => (
        <AgentRow
          key={agent.actorId}
          agent={agent}
          onClick={() => navigate(`/agents/agent/${agent.slug}`)}
        />
      ))}
    </DataRowContainer>
  );
}

function AgentRow({ agent, onClick }: { agent: Agent; onClick?: () => void }): JSX.Element {
  const tags: DataRowTag[] = [
    getTypeTag(agent.type),
    getStatusTag(agent.isActive),
  ];

  return (
    <DataRow
      leading={<Avatar name={agent.name} size="lg" />}
      topRight={elapsedTime(agent.updatedAt)}
      tags={tags}
      onClick={onClick}
    >
      <Text className="pre" style="mono" tone="muted">
        @{agent.slug}
      </Text>
      <Text weight="bold" size="3" tone="default">
        {agent.name}
      </Text>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Text tone="muted" size="2">
          {agent.description ? String(agent.description) : 'No description'}
        </Text>
      </div>
      <div style={{ fontSize: 12 }} className="text--tone-muted">
        {agent.statusTriggers.length > 0 && (
          <span>Triggers: {agent.statusTriggers.join(', ')}</span>
        )}
        {agent.statusTriggers.length > 0 && agent.allowedTools.length > 0 && ' · '}
        {agent.allowedTools.length > 0 && (
          <span>Tools: {agent.allowedTools.length}</span>
        )}
      </div>
    </DataRow>
  );
}

function getTypeTag(type: AgentResponseDto.type): DataRowTag {
  const typeColors: Record<AgentResponseDto.type, DataRowTag['color']> = {
    [AgentResponseDto.type.CLAUDE]: 'purple',
    [AgentResponseDto.type.CODEX]: 'green',
    [AgentResponseDto.type.OPENCODE]: 'blue',
    [AgentResponseDto.type.OTHER]: 'gray',
  };

  return {
    label: type,
    color: typeColors[type] || 'gray',
  };
}

function getStatusTag(isActive: boolean): DataRowTag {
  return {
    label: isActive ? 'active' : 'inactive',
    color: isActive ? 'green' : 'gray',
  };
}
