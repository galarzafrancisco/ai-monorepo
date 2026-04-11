import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, DataRow, Text, DataRowContainer, DataRowTag } from "../../ui/primitives";
import { useAgentsCtx } from "./AgentsProvider";
import { Agent } from "./types";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import type { AgentResponseDto } from "@taico/client/v2";
import { NewAgentPop } from "./NewAgentPop";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import "./AgentsPage.css";

export function AgentsPage() {
  const { agents, setSectionTitle, isLoading, error, createAgent } = useAgentsCtx();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [showNewAgentPop, setShowNewAgentPop] = useState(false);

  // Set document title (browser tab)
  useDocumentTitle();

  // Set page title
  useEffect(() => {
    setSectionTitle("All Agents 🦄");
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

  const handleNewAgentCancel = () => {
    setShowNewAgentPop(false);
  };

  const handleNewAgentSave = async ({ name, slug }: { name: string; slug: string }): Promise<boolean> => {
    try {
      const agent = await createAgent({ name, slug });
      if (agent) {
        navigate(`/agents/agent/${agent.slug}`);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error creating agent');
      console.error(error);
      return false;
    }
  };

  return (
    <>
      <DataRowContainer>
        {agents.map(agent => (
          <AgentRow
            key={agent.actorId}
            agent={agent}
            onClick={() => navigate(`/agents/agent/${agent.slug}`)}
          />
        ))}
      </DataRowContainer>

      <button
        className={`agents-fab ${isDesktop ? 'agents-fab--desktop' : ''}`}
        type="button"
        onClick={() => setShowNewAgentPop(true)}
        aria-label="Create new agent"
      >
        {isDesktop ? (
          <>
            <span className="agents-fab__plus">+</span>
            <span className="agents-fab__label">New agent</span>
          </>
        ) : (
          '+'
        )}
      </button>

      {showNewAgentPop ? (
        <NewAgentPop onCancel={handleNewAgentCancel} onSave={handleNewAgentSave} />
      ) : null}
    </>
  );
}

function AgentRow({ agent, onClick }: { agent: Agent; onClick?: () => void }): React.JSX.Element {
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

function getTypeTag(type: AgentResponseDto['type']): DataRowTag {
  const typeColors: Record<AgentResponseDto['type'], DataRowTag['color']> = {
    'claude': 'purple',
    'codex': 'green',
    'opencode': 'blue',
    'adk': 'red',
    'githubcopilot': 'yellow',
    'other': 'gray',
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
