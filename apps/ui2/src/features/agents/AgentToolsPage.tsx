import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AgentToolPermissionResponseDto } from '@taico/client/v2';
import { useAgentsCtx } from './AgentsProvider';
import { AgentToolPermissionsService } from './api';
import { AddAgentToolPermissionPop } from './AddAgentToolPermissionPop';
import { EditAgentToolPermissionsPop } from './EditAgentToolPermissionsPop';
import { Text, Stack, Button, DataRow, DataRowContainer, Chip } from '../../ui/primitives';
import { useToast } from '../../shared/context/ToastContext';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import type { Agent } from './types';
import './AgentToolsPage.css';

function isSystemTool(permission: AgentToolPermissionResponseDto) {
  return permission.server.providedId === 'tasks' || permission.server.providedId === 'context';
}

function getScopeSummary(permission: AgentToolPermissionResponseDto) {
  if (permission.server.type === 'stdio') {
    return 'No scopes required';
  }

  if (permission.hasAllScopes) {
    return 'All scopes';
  }

  return `${permission.grantedScopes.length} scope${permission.grantedScopes.length === 1 ? '' : 's'} granted`;
}

export function AgentToolsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { agents, setSectionTitle, loadAgentDetails } = useAgentsCtx();
  const { showError } = useToast();

  const agentFromList = agents.find((candidate) => candidate.slug === slug);
  const [agent, setAgent] = useState<Agent | null>(agentFromList || null);
  const [isLoading, setIsLoading] = useState(!agentFromList);
  const [toolPermissions, setToolPermissions] = useState<AgentToolPermissionResponseDto[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [showAddToolPop, setShowAddToolPop] = useState(false);
  const [showEditToolPermissionsPop, setShowEditToolPermissionsPop] = useState(false);
  const [editingToolPermission, setEditingToolPermission] = useState<AgentToolPermissionResponseDto | null>(null);
  const [pendingScopedTool, setPendingScopedTool] = useState<{
    serverId: string;
    serverName: string;
    serverProvidedId: string;
    serverType: 'http' | 'stdio';
  } | null>(null);

  const loadToolPermissions = useCallback(async (actorId: string) => {
    setPermissionsLoading(true);
    try {
      const permissions = await AgentToolPermissionsService.AgentToolPermissionsController_listAgentToolPermissions({
        actorId,
      });
      setToolPermissions(permissions);
    } catch (err) {
      console.error('Failed to load tool permissions:', err);
      showError(err);
    } finally {
      setPermissionsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (!agentFromList && slug) {
      setIsLoading(true);
      loadAgentDetails(slug).then((loadedAgent) => {
        setAgent(loadedAgent);
        setIsLoading(false);
      }).catch(() => {
        setAgent(null);
        setIsLoading(false);
      });
    } else if (agentFromList) {
      setAgent(agentFromList);
      setIsLoading(false);
    }
  }, [slug, agentFromList, loadAgentDetails]);

  useEffect(() => {
    if (!agent) {
      return;
    }
    loadToolPermissions(agent.actorId);
  }, [agent, loadToolPermissions]);

  useEffect(() => {
    if (!agent) {
      setSectionTitle('Tools');
      return;
    }
    setSectionTitle(`${agent.name} Tools`);
  }, [agent, setSectionTitle]);

  useDocumentTitle({ agent: { name: agent ? `${agent.name} Tools` : undefined } });

  const handleOpenAddTool = () => {
    setShowAddToolPop(true);
  };

  const handleOpenEditTool = (permission: AgentToolPermissionResponseDto) => {
    setEditingToolPermission(permission);
    setShowEditToolPermissionsPop(true);
  };

  const handleDeleteToolPermission = async (serverId: string) => {
    if (!agent) {
      return;
    }

    if (!confirm('Remove this tool permission?')) {
      return;
    }

    try {
      await AgentToolPermissionsService.AgentToolPermissionsController_deleteAgentToolPermission({
        actorId: agent.actorId,
        serverId,
      });
      setShowEditToolPermissionsPop(false);
      setEditingToolPermission(null);
      await loadToolPermissions(agent.actorId);
    } catch (err) {
      console.error('Failed to delete tool permission:', err);
      showError(err);
    }
  };

  if (isLoading) {
    return (
      <div className="agent-tools-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Loading tools...</Text>
        </Stack>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="agent-tools-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Agent not found</Text>
          <Button variant="secondary" onClick={() => navigate('/agents')}>
            Back to agents
          </Button>
        </Stack>
      </div>
    );
  }

  const systemTools = toolPermissions.filter(isSystemTool);
  const additionalTools = toolPermissions.filter((permission) => !isSystemTool(permission));

  return (
    <div className="agent-tools-page">
      <DataRowContainer className="agent-tools-page__section">
        <DataRow>
          <Stack spacing="1">
            <Text size="3" weight="medium">Tools</Text>
            <Text size="2" tone="muted">
              Tasks and Context stay available. Additional tools can be assigned per agent with scoped access.
            </Text>
          </Stack>
        </DataRow>
      </DataRowContainer>

      <DataRowContainer title="System Tools" className="agent-tools-page__section">
        {systemTools.map((permission) => (
          <DataRow key={permission.server.id}>
            <div className="agent-tools-page__row">
              <div className="agent-tools-page__row-main">
                <div className="agent-tools-page__row-title">
                  <Text size="2" weight="medium">{permission.server.name}</Text>
                  <div className="agent-tools-page__chips">
                    <Chip color="purple">System Tool</Chip>
                    <Chip color={permission.server.type === 'http' ? 'green' : 'orange'}>
                      {permission.server.type}
                    </Chip>
                  </div>
                </div>
                <Text size="1" tone="muted">{permission.server.description}</Text>
                <Text size="1" tone="muted">{getScopeSummary(permission)}</Text>
              </div>
            </div>
          </DataRow>
        ))}
      </DataRowContainer>

      <DataRowContainer
        title="Additional Tools"
        className="agent-tools-page__section"
      >
        {permissionsLoading ? (
          <DataRow>
            <Text size="2" tone="muted">Loading tool permissions...</Text>
          </DataRow>
        ) : additionalTools.length === 0 ? (
          <DataRow>
            <Stack spacing="1">
              <Text size="2" tone="muted">No additional tools configured</Text>
              <Text size="1" tone="muted">Add a tool to grant this agent access beyond Tasks and Context.</Text>
            </Stack>
          </DataRow>
        ) : (
          additionalTools.map((permission) => (
            <DataRow
              key={permission.server.id}
              onClick={() => handleOpenEditTool(permission)}
              trailing={<Text size="2" tone="muted">Edit</Text>}
            >
              <div className="agent-tools-page__row">
                <div className="agent-tools-page__row-main">
                  <div className="agent-tools-page__row-title">
                    <Text size="2" weight="medium">{permission.server.name}</Text>
                    <div className="agent-tools-page__chips">
                      <Chip color={permission.server.type === 'http' ? 'green' : 'orange'}>
                        {permission.server.type}
                      </Chip>
                    </div>
                  </div>
                  <Text size="1" tone="muted">{permission.server.description}</Text>
                  <Text size="1" tone="muted">{getScopeSummary(permission)}</Text>
                </div>
              </div>
            </DataRow>
          ))
        )}
      </DataRowContainer>

      <DataRowContainer className="agent-tools-page__actions">
        <Button
          size="lg"
          onClick={handleOpenAddTool}
        >
          Add Tool
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => navigate(`/agents/agent/${agent.slug}`)}
        >
          Back to agent details
        </Button>
      </DataRowContainer>

      {showAddToolPop && (
        <AddAgentToolPermissionPop
          currentPermissions={toolPermissions.map((permission) => ({
            serverId: permission.server.id,
          }))}
          onCancel={() => setShowAddToolPop(false)}
          onSaveUnscopedTool={async (tool) => {
            await AgentToolPermissionsService.AgentToolPermissionsController_upsertAgentToolPermission({
              actorId: agent.actorId,
              serverId: tool.id,
              body: { scopeIds: [] },
            });
            await loadToolPermissions(agent.actorId);
          }}
          onConfigureScopedTool={(tool, _scopes) => {
            setPendingScopedTool({
              serverId: tool.id,
              serverName: tool.name,
              serverProvidedId: tool.providedId,
              serverType: tool.type,
            });
          }}
        />
      )}

      {showEditToolPermissionsPop && (
        <EditAgentToolPermissionsPop
          agentActorId={agent.actorId}
          currentPermissions={toolPermissions.map((permission) => ({
            serverId: permission.server.id,
            serverName: permission.server.name,
            serverProvidedId: permission.server.providedId,
            serverType: permission.server.type,
            scopeIds: permission.grantedScopes.map((scope) => scope.id),
            hasAllScopes: permission.hasAllScopes,
          }))}
          editingPermission={editingToolPermission ? {
            serverId: editingToolPermission.server.id,
            serverName: editingToolPermission.server.name,
            serverProvidedId: editingToolPermission.server.providedId,
            serverType: editingToolPermission.server.type,
            scopeIds: editingToolPermission.grantedScopes.map((scope) => scope.id),
            hasAllScopes: editingToolPermission.hasAllScopes,
          } : null}
          onCancel={() => {
            setShowEditToolPermissionsPop(false);
            setEditingToolPermission(null);
          }}
          onSave={async () => {
            await loadToolPermissions(agent.actorId);
            setShowEditToolPermissionsPop(false);
            setEditingToolPermission(null);
          }}
          onDelete={editingToolPermission ? async () => {
            await handleDeleteToolPermission(editingToolPermission.server.id);
          } : undefined}
        />
      )}

      {pendingScopedTool && (
        <EditAgentToolPermissionsPop
          agentActorId={agent.actorId}
          currentPermissions={toolPermissions.map((permission) => ({
            serverId: permission.server.id,
            serverName: permission.server.name,
            serverProvidedId: permission.server.providedId,
            serverType: permission.server.type,
            scopeIds: permission.grantedScopes.map((scope) => scope.id),
            hasAllScopes: permission.hasAllScopes,
          }))}
          fixedTool={pendingScopedTool}
          title="Select Scopes"
          saveLabel="save"
          onCancel={() => setPendingScopedTool(null)}
          onSave={async () => {
            await loadToolPermissions(agent.actorId);
            setPendingScopedTool(null);
          }}
        />
      )}
    </div>
  );
}
