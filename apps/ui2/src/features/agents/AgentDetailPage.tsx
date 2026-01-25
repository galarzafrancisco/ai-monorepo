import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgentsCtx } from './AgentsProvider';
import { Text, Stack, Button, Avatar, DataRow, DataRowTag, DataRowContainer } from '../../ui/primitives';
import { DeleteWithConfirmation } from '../../ui/components';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { Agent, AgentToken } from './types';
import { ActorResponseDto, AgentResponseDto, AuthorizationServerService, ScopeDto } from 'shared';
import { AgentTokensService } from './api';
import { EditSystemPromptPop } from './EditSystemPromptPop';
import { EditStatusTriggersPop } from './EditStatusTriggersPop';
import { TaskStatus } from '../../shared/const/taskStatus';
import './AgentDetailPage.css';
import { useActorsCtx } from '../actors';

const DEFAULT_SCOPES = ['meta:read'];

export function AgentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { agents, setSectionTitle, loadAgentDetails, updateAgent, deleteAgent } = useAgentsCtx();

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
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set(DEFAULT_SCOPES));
  const [tokenExpDays, setTokenExpDays] = useState(30);

  // Available scopes from the API
  const [availableScopes, setAvailableScopes] = useState<ScopeDto[]>([]);
  const [scopesLoading, setScopesLoading] = useState(false);

  // Edit agent state
  const [showEditSystemPromptPop, setShowEditSystemPromptPop] = useState(false);
  const [showEditStatusTriggersPop, setShowEditStatusTriggersPop] = useState(false);

  // Find actor associated with this agent
  const { actors } = useActorsCtx();
  const [actor, setActor] = useState<ActorResponseDto | null>(null);
  useEffect(() => {
    if (!agent || !actors) {
      return;
    }
    const actor = actors.find(actor => actor.id === agent.actorId)
    if (actor) {
      setActor(actor);
    }
  }, [agent, actors]);

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

  // Load available scopes from the API
  const loadScopes = useCallback(async () => {
    setScopesLoading(true);
    try {
      const response = await AuthorizationServerService.authorizationControllerGetScopes();
      setAvailableScopes(response.scopes);
    } catch (err) {
      console.error('Failed to load scopes:', err);
    } finally {
      setScopesLoading(false);
    }
  }, []);

  // Load agent details if not in list
  useEffect(() => {
    if (!agentFromList && slug) {
      setIsLoading(true);
      console.log("AGENT DETAIL PAGE")
      loadAgentDetails(slug).then((loadedAgent) => {
        setAgent(loadedAgent);
        setIsLoading(false);
      }).catch(e => {
        setAgent(null);
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

  // Load available scopes when create form is shown
  useEffect(() => {
    if (showCreateForm && availableScopes.length === 0) {
      loadScopes();
    }
    if (!showCreateForm) {
      setSelectedScopes(new Set(DEFAULT_SCOPES)); // Reset to defaults
    }
  }, [showCreateForm, availableScopes.length, loadScopes]);

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
    if (!slug || !tokenName.trim() || selectedScopes.size === 0) return;
    setIsCreatingToken(true);
    try {
      const scopes = Array.from(selectedScopes);
      const result = await AgentTokensService.agentTokensControllerIssueToken(slug, {
        name: tokenName.trim(),
        scopes,
        expirationDays: tokenExpDays,
      });
      setNewlyCreatedToken(result.token);
      setShowCreateForm(false);
      setTokenName('');
      setSelectedScopes(new Set(DEFAULT_SCOPES)); // Reset to defaults
      await loadTokens();
    } catch (err) {
      console.error('Failed to create token:', err);
      alert('Failed to create token');
    } finally {
      setIsCreatingToken(false);
    }
  };

  // Toggle a scope selection
  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(scopeId)) {
        newSet.delete(scopeId);
      } else {
        newSet.add(scopeId);
      }
      return newSet;
    });
  };

  // Handle saving system prompt
  const handleSaveSystemPrompt = async ({ systemPrompt }: { systemPrompt: string }): Promise<boolean> => {
    if (!agent) return false;
    try {
      const updated = await updateAgent(agent.actorId, { systemPrompt });
      if (updated) {
        setAgent(updated);
        setShowEditSystemPromptPop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update system prompt:', err);
      return false;
    }
  };

  // Handle saving status triggers
  const handleSaveStatusTriggers = async ({ statusTriggers }: { statusTriggers: TaskStatus[] }): Promise<boolean> => {
    if (!agent) return false;
    try {
      const updated = await updateAgent(agent.actorId, { statusTriggers });
      if (updated) {
        setAgent(updated);
        setShowEditStatusTriggersPop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update status triggers:', err);
      return false;
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
          // TODO: this agent doesn't come with Actor, so I can't get the avatar.
          leading={<Avatar size="sm" name={agent.name} src={actor?.avatarUrl || undefined} />}
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
        <DataRow onClick={() => setShowEditSystemPromptPop(true)}>
          <Text size="2" className="agent-detail-page__system-prompst">
            {agent.systemPrompt || 'No system prompt configured'}
          </Text>
          <Text size="1" tone="muted">tap to edit</Text>
        </DataRow>
      </DataRowContainer>

      {/* Status Triggers */}
      <DataRowContainer title="Status Triggers" className="agent-detail-page__section">
        <DataRow onClick={() => setShowEditStatusTriggersPop(true)}>
          {agent.statusTriggers.length > 0 ? (
            agent.statusTriggers.map(statusTrigger =>
              <Text key={statusTrigger} tone="muted">
                {statusTrigger}
              </Text>
            )
          ) : (
            <Text tone="muted">No status triggers configured</Text>
          )}
          <Text size="1" tone="muted">tap to edit</Text>
        </DataRow>
      </DataRowContainer>

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
        {/*
        This looks like shit but it's functional, so I'm shipping it now. 
        TODO: Make it more consistent with the iOS theme.
        */}
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
                  <Text size="1" tone="muted">Scopes</Text>
                </label>
                {scopesLoading ? (
                  <Text size="2" tone="muted">Loading available scopes...</Text>
                ) : (
                  <div className="agent-detail-page__scopes-list">
                    {availableScopes.map((scope) => (
                      <label key={scope.id} className="agent-detail-page__scope-item">
                        <input
                          type="checkbox"
                          checked={selectedScopes.has(scope.id)}
                          onChange={() => toggleScope(scope.id)}
                        />
                        <div className="agent-detail-page__scope-info">
                          <Text size="2" weight="medium">{scope.id}</Text>
                          <Text size="1" tone="muted">{scope.description}</Text>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
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
                  disabled={isCreatingToken || !tokenName.trim() || selectedScopes.size === 0}
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

      {/* Delete */}
      <DeleteWithConfirmation
        className="agent-detail-page__actions"
        onDelete={async () => {
          // TODO: Hack! I redirect before getting confirmation of delete.
          // This is intentionally hacky, because when I get confirmation of deletion,
          // this page renders again which throws an error for whatever reason. Fix!
          deleteAgent(agent.actorId);
          navigate('/agents');
        }}
      />

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

      {/* Pops */}
      {showEditSystemPromptPop && agent && (
        <EditSystemPromptPop
          initialValue={agent.systemPrompt}
          onCancel={() => setShowEditSystemPromptPop(false)}
          onSave={handleSaveSystemPrompt}
        />
      )}
      {showEditStatusTriggersPop && agent && (
        <EditStatusTriggersPop
          initialValue={agent.statusTriggers as TaskStatus[]}
          onCancel={() => setShowEditStatusTriggersPop(false)}
          onSave={handleSaveStatusTriggers}
        />
      )}
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
