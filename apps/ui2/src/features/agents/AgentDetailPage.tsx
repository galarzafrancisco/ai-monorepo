import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgentsCtx } from './AgentsProvider';
import { Text, Stack, Button, Avatar, DataRow, DataRowTag, DataRowContainer } from '../../ui/primitives';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { Agent, AgentToken } from './types';
import { AgentResponseDto } from 'shared';
import { AgentTokensService } from './api';
import './AgentDetailPage.css';

export function AgentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { agents, setSectionTitle, loadAgentDetails } = useAgentsCtx();

  // Find agent from context first (for quick load)
  const agentFromList = agents.find(a => a.slug === slug);
  const [agent, setAgent] = useState<Agent | null>(agentFromList || null);
  const [isLoading, setIsLoading] = useState(!agentFromList);

  // Token management state
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenScopes, setTokenScopes] = useState('tasks:read,tasks:write');
  const [tokenExpDays, setTokenExpDays] = useState(30);

  // Load tokens for this agent
  const loadTokens = useCallback(async () => {
    if (!slug) return;
    setTokensLoading(true);
    try {
      const loadedTokens = await AgentTokensService.agentTokensControllerListTokens(slug);
      setTokens(loadedTokens);
    } catch (err) {
      console.error('Failed to load tokens:', err);
    } finally {
      setTokensLoading(false);
    }
  }, [slug]);

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

  // Load tokens when agent is loaded
  useEffect(() => {
    if (agent) {
      loadTokens();
    }
  }, [agent, loadTokens]);

  // Set section title for IosShell
  useEffect(() => {
    if (!agent) {
      setSectionTitle('Agent');
      return;
    }
    setSectionTitle(agent.name);
  }, [agent, setSectionTitle]);

  // Handle creating a new token
  const handleCreateToken = async () => {
    if (!slug || !tokenName.trim()) return;
    setIsCreatingToken(true);
    try {
      const scopes = tokenScopes.split(',').map(s => s.trim()).filter(Boolean);
      const result = await AgentTokensService.agentTokensControllerIssueToken(slug, {
        name: tokenName.trim(),
        scopes,
        expirationDays: tokenExpDays,
      });
      setNewlyCreatedToken(result.token);
      setShowCreateForm(false);
      setTokenName('');
      await loadTokens();
    } catch (err) {
      console.error('Failed to create token:', err);
      alert('Failed to create token');
    } finally {
      setIsCreatingToken(false);
    }
  };

  // Handle revoking a token
  const handleRevokeToken = async (tokenId: string) => {
    if (!slug) return;
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }
    try {
      await AgentTokensService.agentTokensControllerRevokeToken(slug, tokenId);
      await loadTokens();
    } catch (err) {
      console.error('Failed to revoke token:', err);
      alert('Failed to revoke token');
    }
  };

  // Copy token to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
          <Text as="span" weight="normal" tone="muted" size="3">
            {` @${agent.slug} `}
          </Text>
          <Text as="span" tone="muted" style="mono">
            #{agent.actorId.slice(0, 6)}
          </Text>

          {/* Description */}
          <Text>
            {agent.description ? String(agent.description) : 'No description'}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* System Prompt */}
      <DataRowContainer title="System Prompt" className="agent-detail-page__section">
        <DataRow>
          <Text size="2" className="agent-detail-page__system-prompst">
            {agent.systemPrompt || 'No system prompt configured'}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Status Triggers */}
      {agent.statusTriggers.length > 0 && (
        <DataRowContainer title="Status Triggers" className="agent-detail-page__section">
          {agent.statusTriggers.map(statusTrigger => 
            <DataRow key={statusTrigger}>
              <Text tone="muted">
                {statusTrigger}
              </Text>
            </DataRow>
          )}
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

      {/* Newly Created Token Alert */}
      {newlyCreatedToken && (
        <DataRowContainer title="New Token Created" className="agent-detail-page__section agent-detail-page__new-token">
          <DataRow>
            <Stack spacing="2">
              <Text weight="medium" size="2" className="agent-detail-page__warning-text">
                Copy this token now. It will not be shown again.
              </Text>
              <div className="agent-detail-page__token-display">
                <code className="agent-detail-page__token-code">
                  {newlyCreatedToken}
                </code>
              </div>
              <div className="agent-detail-page__button-row">
                <Button size="sm" onClick={() => copyToClipboard(newlyCreatedToken)}>
                  Copy Token
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setNewlyCreatedToken(null)}>
                  Dismiss
                </Button>
              </div>
            </Stack>
          </DataRow>
        </DataRowContainer>
      )}

      {/* Access Tokens Section */}
      <DataRowContainer
        title="Access Tokens"
        className="agent-detail-page__section"
        action={
          !showCreateForm && (
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              New Token
            </Button>
          )
        }
      >
        {/* Create Token Form */}
        {showCreateForm && (
          <DataRow>
            <Stack spacing="3">
              <Text weight="medium" size="2">Create New Token</Text>
              <div className="agent-detail-page__form-field">
                <label>
                  <Text size="1" tone="muted">Token Name</Text>
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g., CI/CD Pipeline"
                  className="agent-detail-page__input"
                />
              </div>
              <div className="agent-detail-page__form-field">
                <label>
                  <Text size="1" tone="muted">Scopes (comma-separated)</Text>
                </label>
                <input
                  type="text"
                  value={tokenScopes}
                  onChange={(e) => setTokenScopes(e.target.value)}
                  placeholder="tasks:read,tasks:write"
                  className="agent-detail-page__input"
                />
              </div>
              <div className="agent-detail-page__form-field">
                <label>
                  <Text size="1" tone="muted">Expires in (days)</Text>
                </label>
                <input
                  type="number"
                  value={tokenExpDays}
                  onChange={(e) => setTokenExpDays(parseInt(e.target.value) || 30)}
                  min={1}
                  max={365}
                  className="agent-detail-page__input"
                />
              </div>
              <div className="agent-detail-page__button-row">
                <Button
                  size="sm"
                  onClick={handleCreateToken}
                  disabled={isCreatingToken || !tokenName.trim()}
                >
                  {isCreatingToken ? 'Creating...' : 'Create Token'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </Stack>
          </DataRow>
        )}

        {/* Tokens List */}
        {tokensLoading ? (
          <DataRow>
            <Text tone="muted" size="2">Loading tokens...</Text>
          </DataRow>
        ) : tokens.length === 0 ? (
          <DataRow>
            <Text tone="muted" size="2">No tokens issued for this agent yet.</Text>
          </DataRow>
        ) : (
          tokens.map((token) => (
            <DataRow
              key={token.id}
              tags={[
                token.isValid
                  ? { label: 'active', color: 'green' as const }
                  : { label: token.revokedAt ? 'revoked' : 'expired', color: 'gray' as const }
              ]}
              topRight={
                token.isValid ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRevokeToken(token.id)}
                  >
                    Revoke
                  </Button>
                ) : null
              }
            >
              <Text weight="medium" size="2">{token.name}</Text>
              <Stack spacing="1">
                <Text size="1" tone="muted">
                  Scopes: {token.scopes.join(', ')}
                </Text>
                <Text size="1" tone="muted">
                  Created: {new Date(token.createdAt).toLocaleDateString()} by {token.issuedByDisplayName}
                </Text>
                <Text size="1" tone="muted">
                  Expires: {new Date(token.expiresAt).toLocaleDateString()}
                </Text>
                {token.revokedAt && (
                  <Text size="1" tone="muted" className="agent-detail-page__revoked-text">
                    Revoked: {new Date(String(token.revokedAt)).toLocaleDateString()}
                  </Text>
                )}
              </Stack>
            </DataRow>
          ))
        )}
      </DataRowContainer>

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
    [AgentResponseDto.type.CLAUDE]: 'orange',
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
