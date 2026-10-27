import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Plus, Wrench } from 'lucide-react';
import type { AgentToolPermissionResponseDto } from '@taico/client/v2';
import { useAgentsCtx } from './AgentsProvider';
import { AgentToolPermissionsService } from './api';
import { AddAgentToolPermissionPop } from './AddAgentToolPermissionPop';
import { EditAgentToolPermissionsPop } from './EditAgentToolPermissionsPop';
import { Text, Stack, Button, InsetGroup, InsetRow } from '../../ui/primitives';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { useToast } from '../../shared/context/ToastContext';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import type { Agent } from './types';
import { isSystemTool, toolScopeSummary } from './agentDisplay';
import './AgentDetailPage.css';
import './AgentToolsPage.css';

export function AgentToolsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { agents, setSectionTitle, loadAgentDetails } = useAgentsCtx();
  const { showError } = useToast();
  const isDesktop = useIsDesktop();

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
    setSectionTitle('Tools');
  }, [setSectionTitle]);

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

  const toolRow = (permission: AgentToolPermissionResponseDto, editable: boolean) => (
    <InsetRow
      key={permission.server.id}
      leading={<span className="agent-tool-icon"><Wrench size={15} strokeWidth={2.2} aria-hidden /></span>}
      label={permission.server.name}
      value={toolScopeSummary(permission)}
      detail={permission.server.description || permission.server.type}
      onClick={editable ? () => handleOpenEditTool(permission) : undefined}
    />
  );

  return (
    <div className={`agent-tools-page ${isDesktop ? 'agent-tools-page--desktop' : 'agent-tools-page--mobile'}`}>
      {isDesktop && (
        <>
          <nav className="agent-detail-page__breadcrumb" aria-label="Breadcrumb">
            <Link to="/agents">Agents</Link>
            <ChevronRight size={14} aria-hidden />
            <Link to={`/agents/agent/${agent.slug}`}>{agent.name}</Link>
            <ChevronRight size={14} aria-hidden />
            <span>Tools</span>
          </nav>
          <div className="agent-tools-page__header">
            <h1 className="agent-tools-page__title">Tools</h1>
            <Button onClick={handleOpenAddTool}>
              <Plus size={16} aria-hidden />
              Add tool
            </Button>
          </div>
        </>
      )}

      <InsetGroup
        title="Built in"
        footer="Tasks and Context are always available to every agent."
      >
        {systemTools.map((permission) => toolRow(permission, false))}
      </InsetGroup>

      <InsetGroup
        title="Additional"
        footer="Grant this agent access to more MCP servers, with the scopes you choose."
      >
        {permissionsLoading && additionalTools.length === 0 ? (
          <InsetRow label={<span className="agent-tools-page__muted">Loading…</span>} />
        ) : (
          additionalTools.map((permission) => toolRow(permission, true))
        )}
        {!isDesktop && (
          <InsetRow
            tone="accent"
            leading={<Plus size={20} aria-hidden />}
            label="Add tool"
            onClick={handleOpenAddTool}
          />
        )}
        {isDesktop && !permissionsLoading && additionalTools.length === 0 && (
          <InsetRow label={<span className="agent-tools-page__muted">No additional tools</span>} />
        )}
      </InsetGroup>

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
          saveLabel="Save"
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
