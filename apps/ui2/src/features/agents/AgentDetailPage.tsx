import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgentsCtx } from './AgentsProvider';
import { Text, Stack, Button, Avatar, DataRow, DataRowTag, DataRowContainer, Chip } from '../../ui/primitives';
import { DeleteWithConfirmation } from '../../ui/components';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { Agent, AgentToken } from './types';
import { ActorResponseDto, AgentResponseDto, AuthorizationServerService, ScopeDto, MetaService, MetaTagResponseDto } from "@taico/client";
import { AgentTokensService } from './api';
import { EditSystemPromptPop } from './EditSystemPromptPop';
import { EditStatusTriggersPop } from './EditStatusTriggersPop';
import { EditTagTriggersPop } from './EditTagTriggersPop';
import { EditIntroductionPop } from './EditIntroductionPop';
import { EditAgentTypePop } from './EditAgentTypePop';
import { EditAgentModelPop } from './EditAgentModelPop';
import { TaskStatus } from '../../shared/const/taskStatus';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import './AgentDetailPage.css';
import { useActorsCtx } from '../actors';

const DEFAULT_SCOPES = ['meta:read'];

export function AgentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { agents, setSectionTitle, loadAgentDetails, updateAgent, deleteAgent } = useAgentsCtx();
  const { showError } = useToast();

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

  // All tags for displaying tag triggers
  const [allTags, setAllTags] = useState<MetaTagResponseDto[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  // Edit agent state
  const [showEditSystemPromptPop, setShowEditSystemPromptPop] = useState(false);
  const [showEditStatusTriggersPop, setShowEditStatusTriggersPop] = useState(false);
  const [showEditTagTriggersPop, setShowEditTagTriggersPop] = useState(false);
  const [showEditAgentTypePop, setShowEditAgentTypePop] = useState(false);
  const [showEditIntroductionPop, setShowEditIntroductionPop] = useState(false);
  const [showEditModelPop, setShowEditModelPop] = useState(false);

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

  // Load all tags for displaying tag triggers
  const loadTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const tags = await MetaService.metaControllerGetAllTags();
      setAllTags(tags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setTagsLoading(false);
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
      loadTags();
    }
  }, [agent, loadTokens, loadTags]);

  // Load available scopes when create form is shown
  useEffect(() => {
    if (showCreateForm && availableScopes.length === 0) {
      loadScopes();
    }
    if (!showCreateForm) {
      setSelectedScopes(new Set(DEFAULT_SCOPES)); // Reset to defaults
    }
  }, [showCreateForm, availableScopes.length, loadScopes]);

  // Set document title (browser tab)
  useDocumentTitle({ agent: { name: agent?.name } });

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
      showError(err);
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
      showError(err);
      return false;
    }
  };

  // Handle saving tag triggers
  const handleSaveTagTriggers = async ({ tagTriggers }: { tagTriggers: string[] }): Promise<boolean> => {
    if (!agent) return false;
    try {
      const updated = await updateAgent(agent.actorId, { tagTriggers });
      if (updated) {
        setAgent(updated);
        setShowEditTagTriggersPop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update tag triggers:', err);
      showError(err);
      return false;
    }
  };

  // Handle saving introduction
  const handleSaveIntroduction = async ({ introduction }: { introduction: string }): Promise<boolean> => {
    if (!agent) return false;
    try {
      const updated = await updateAgent(agent.actorId, { introduction });
      if (updated) {
        setAgent(updated);
        setShowEditIntroductionPop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update introduction:', err);
      showError(err);
      return false;
    }
  };

  // Handle saving agent type
  const handleSaveAgentType = async ({ type }: { type: AgentResponseDto.type }): Promise<boolean> => {
    if (!agent) return false;
    try {
      const updated = await updateAgent(agent.actorId, { type });
      if (updated) {
        setAgent(updated);
        setShowEditAgentTypePop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update agent type:', err);
      showError(err);
      return false;
    }
  };

  const handleSaveModelConfig = async ({
    providerId,
    modelId,
  }: {
    providerId: string;
    modelId: string;
  }): Promise<boolean> => {
    if (!agent) return false;
    try {
      const updated = await updateAgent(agent.actorId, { providerId, modelId });
      if (updated) {
        setAgent(updated);
        setShowEditModelPop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update model config:', err);
      showError(err);
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

  const introductionValue = agent.introduction as unknown;
  const introductionText = typeof introductionValue === 'string' ? introductionValue : '';
  const providerLabel = agent.providerId && agent.providerId.trim().length > 0
    ? agent.providerId
    : 'Default provider';
  const modelLabel = agent.modelId && agent.modelId.trim().length > 0
    ? agent.modelId
    : 'Default model';

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
          <Text size="2" className="agent-detail-page__system-prompt">
            {agent.systemPrompt || 'No system prompt configured'}
          </Text>
          <Text size="1" tone="muted">tap to edit</Text>
        </DataRow>
      </DataRowContainer>

      {/* Introduction */}
      <DataRowContainer title="Introduction" className="agent-detail-page__section">
        <DataRow onClick={() => setShowEditIntroductionPop(true)}>
          <Text size="2" className="agent-detail-page__system-prompt">
            {introductionText.trim().length > 0 ? introductionText : 'No introduction configured'}
          </Text>
          <Text size="1" tone="muted">tap to edit</Text>
        </DataRow>
      </DataRowContainer>

      {/* Agent Type */}
      <DataRowContainer title="Agent Type" className="agent-detail-page__section">
        <DataRow onClick={() => setShowEditAgentTypePop(true)}>
          <Text size="2" tone="muted">
            {agent.type}
          </Text>
          <Text size="1" tone="muted">tap to edit</Text>
        </DataRow>
      </DataRowContainer>

      {/* Model */}
      <DataRowContainer title="Model" className="agent-detail-page__section">
        <DataRow onClick={() => setShowEditModelPop(true)}>
          <Stack spacing="1">
            <Text size="2" tone="muted">
              Provider: {providerLabel}
            </Text>
            <Text size="2" tone="muted">
              Model: {modelLabel}
            </Text>
          </Stack>
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

      {/* Tag Triggers */}
      <DataRowContainer title="Tag Triggers" className="agent-detail-page__section">
        <DataRow onClick={() => setShowEditTagTriggersPop(true)}>
          {agent.tagTriggers && agent.tagTriggers.length > 0 ? (
            <div className="agent-detail-page__tag-triggers">
              {tagsLoading ? (
                <Text tone="muted">Loading tags...</Text>
              ) : (
                allTags
                  .filter(tag => agent.tagTriggers.includes(tag.id))
                  .map(tag => (
                    <Chip key={tag.id} color={getChipColorFromHex(tag.color)}>
                      {tag.name}
                    </Chip>
                  ))
              )}
            </div>
          ) : (
            <Text tone="muted">No tag triggers configured</Text>
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
      {showEditTagTriggersPop && agent && (
        <EditTagTriggersPop
          initialValue={agent.tagTriggers || []}
          onCancel={() => setShowEditTagTriggersPop(false)}
          onSave={handleSaveTagTriggers}
        />
      )}
      {showEditAgentTypePop && agent && (
        <EditAgentTypePop
          initialValue={agent.type}
          onCancel={() => setShowEditAgentTypePop(false)}
          onSave={handleSaveAgentType}
        />
      )}
      {showEditIntroductionPop && agent && (
        <EditIntroductionPop
          initialValue={introductionText}
          onCancel={() => setShowEditIntroductionPop(false)}
          onSave={handleSaveIntroduction}
        />
      )}
      {showEditModelPop && agent && (
        <EditAgentModelPop
          initialProviderId={agent.providerId ?? ''}
          initialModelId={agent.modelId ?? ''}
          onCancel={() => setShowEditModelPop(false)}
          onSave={handleSaveModelConfig}
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
    [AgentResponseDto.type.ADK]: 'red',
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

// Map hex color to Chip color
function getChipColorFromHex(hex: string | null | undefined): "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple" {
  if (!hex) return 'gray';

  // Simple color mapping based on common hex values
  const colorMap: Record<string, "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple"> = {
    '#6B7280': 'gray',
    '#3B82F6': 'blue',
    '#10B981': 'green',
    '#52B788': 'green',
    '#F59E0B': 'yellow',
    '#F97316': 'orange',
    '#EF4444': 'red',
    '#8B5CF6': 'purple',
    '#A855F7': 'purple',
    '#98D8C8': 'green',
  };

  // Try exact match first
  if (colorMap[hex]) return colorMap[hex];

  // Fallback to heuristic based on hex value
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Simple heuristic: which channel dominates
  if (r > g && r > b) {
    if (g > 100) return 'orange';
    return 'red';
  } else if (g > r && g > b) {
    return 'green';
  } else if (b > r && b > g) {
    if (r > 100) return 'purple';
    return 'blue';
  } else if (r > 150 && g > 150 && b < 100) {
    return 'yellow';
  }

  return 'gray';
}
