import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgentsCtx } from './AgentsProvider';
import { Text, Stack, Button, Avatar, DataRow, DataRowTag, DataRowContainer } from '../../ui/primitives';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { Agent } from './types';
import { AgentResponseDto } from 'shared';
import './AgentDetailPage.css';

export function AgentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { agents, setSectionTitle, loadAgentDetails } = useAgentsCtx();

  // Find agent from context first (for quick load)
  const agentFromList = agents.find(a => a.slug === slug);
  const [agent, setAgent] = useState<Agent | null>(agentFromList || null);
  const [isLoading, setIsLoading] = useState(!agentFromList);

  // Load agent details if not in list
  useEffect(() => {
    if (!agentFromList && slug) {
      setIsLoading(true);
      loadAgentDetails(slug).then((loadedAgent) => {
        setAgent(loadedAgent);
        setIsLoading(false);
      });
    } else if (agentFromList) {
      setAgent(agentFromList);
    }
  }, [slug, agentFromList, loadAgentDetails]);

  // Set section title for IosShell
  useEffect(() => {
    if (!agent) {
      setSectionTitle('Agent');
      return;
    }
    setSectionTitle(agent.name);
  }, [agent, setSectionTitle]);

  // Loading state
  if (isLoading) {
    return (
      <div className="agent-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Loading agent...</Text>
        </Stack>
      </div>
    );
  }

  // If agent not found
  if (!agent) {
    return (
      <div className="agent-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Agent not found</Text>
          <Button variant="secondary" onClick={() => navigate('/agents')}>
            Back to agents
          </Button>
        </Stack>
      </div>
    );
  }

  return (
    <div className="agent-detail-page">

      {/* Meta */}
      <DataRowContainer className="agent-detail-page__section">
        <DataRow
          leading={<Avatar size="sm" name={agent.name} />}
          tags={[
            getTypeTag(agent.type),
            getStatusTag(agent.isActive),
          ]}
          topRight={<Text size="1" tone="muted">{elapsedTime(agent.updatedAt)}</Text>}
        >
          <Text as="span" weight="medium" size="3">
            {agent.name}
          </Text>
          <Text as="span" weight="normal" tone="muted" size="3">
            {` @${agent.slug}`}
          </Text>
          <Text as="span" tone="muted" style="mono">
            #{agent.actorId.slice(0, 6)}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Description */}
      <DataRowContainer className="agent-detail-page__section">
        <DataRow
          leading={<Avatar size="sm" name={agent.name} />}
          topRight={<Text size="1" tone="muted">{elapsedTime(agent.createdAt)}</Text>}
        >
          <Text as="span" weight="medium" size="3">
            Description
          </Text>
          <Text>
            {agent.description ? String(agent.description) : 'No description'}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* System Prompt */}
      <DataRowContainer className="agent-detail-page__section">
        <DataRow>
          <Text as="span" weight="medium" size="3">
            System Prompt
          </Text>
          <Text size="2" className="agent-detail-page__system-prompt">
            {agent.systemPrompt || 'No system prompt configured'}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Status Triggers */}
      {agent.statusTriggers.length > 0 && (
        <DataRowContainer className="agent-detail-page__section">
          <DataRow>
            <Text as="span" weight="medium" size="3">
              Status Triggers
            </Text>
            <Text tone="muted">
              {agent.statusTriggers.join(', ')}
            </Text>
          </DataRow>
        </DataRowContainer>
      )}

      {/* Allowed Tools */}
      {agent.allowedTools.length > 0 && (
        <DataRowContainer className="agent-detail-page__section">
          <DataRow>
            <Text as="span" weight="medium" size="3">
              Allowed Tools ({agent.allowedTools.length})
            </Text>
            <Text tone="muted" size="2">
              {agent.allowedTools.join(', ')}
            </Text>
          </DataRow>
        </DataRowContainer>
      )}

      {/* Concurrency */}
      {agent.concurrencyLimit && (
        <DataRowContainer className="agent-detail-page__section">
          <DataRow>
            <Text as="span" weight="medium" size="3">
              Concurrency Limit
            </Text>
            <Text tone="muted">
              {String(agent.concurrencyLimit)}
            </Text>
          </DataRow>
        </DataRowContainer>
      )}

      {/* Back button */}
      <DataRowContainer className="agent-detail-page__actions">
        <Button
          size="lg"
          variant="secondary"
          onClick={() => navigate('/agents')}
        >
          Back to Agents
        </Button>
      </DataRowContainer>
    </div>
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
