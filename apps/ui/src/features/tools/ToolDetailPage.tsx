import { useState, useEffect, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToolsCtx } from './ToolsProvider';
import { Text, Stack, Button, Avatar, DataRow, DataRowTag, DataRowContainer, Chip, Card } from '../../ui/primitives';
import { DeleteWithConfirmation } from '../../ui/components';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { Tool, ToolScope, ToolClient, ToolAuthorization, ToolScopeMapping } from './types';
import { ToolsService } from './api';
import { EditToolNamePop } from './EditToolNamePop';
import { EditToolDescriptionPop } from './EditToolDescriptionPop';
import { EditToolUrlPop } from './EditToolUrlPop';
import { EditToolCommandPop } from './EditToolCommandPop';
import { EditToolScopesPop } from './EditToolScopesPop';
import './ToolDetailPage.css';

type ProtectedResourceMetadata = {
  authorization_servers?: string[];
};

const EMPTY_CONNECTION_FORM = {
  friendlyName: '',
  providedId: '',
  clientId: '',
  clientSecret: '',
  authorizeUrl: '',
  tokenUrl: '',
};

const EMPTY_MAPPING_FORM = {
  scopeId: '',
  connectionId: '',
  downstreamScope: '',
};

// Helper to get status color and label
function getAuthStatusDisplay(status: string): { color: 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'purple', label: string } {
  switch (status) {
    case 'AUTHORIZATION_CODE_EXCHANGED':
      return { color: 'green', label: 'Active' };
    case 'USER_CONSENT_REJECTED':
      return { color: 'red', label: 'Rejected' };
    case 'AUTHORIZATION_CODE_ISSUED':
      return { color: 'blue', label: 'Code Issued' };
    case 'mcp_auth_flow_started':
      return { color: 'yellow', label: 'Flow Started' };
    case 'mcp_auth_flow_completed':
      return { color: 'blue', label: 'MCP Auth Complete' };
    case 'CONNECTIONS_FLOW_STARTED':
      return { color: 'yellow', label: 'Connecting' };
    case 'CONNECTIONS_FLOW_COMPLETED':
      return { color: 'blue', label: 'Connected' };
    case 'not_started':
      return { color: 'gray', label: 'Not Started' };
    default:
      return { color: 'gray', label: status.replace(/_/g, ' ').toLowerCase() };
  }
}

export function ToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { tools, setSectionTitle, loadToolDetails, loadToolScopes, loadToolClients, loadToolAuthorizations, updateTool, deleteTool } = useToolsCtx();
  const { showError, showToast } = useToast();

  // Find tool from context first (for quick load)
  const toolFromList = tools.find(t => t.id === toolId);
  const [tool, setTool] = useState<Tool | null>(toolFromList || null);
  const [scopes, setScopes] = useState<ToolScope[]>([]);
  const [clients, setClients] = useState<ToolClient[]>([]);
  const [scopeMappings, setScopeMappings] = useState<ToolScopeMapping[]>([]);
  const [authorizations, setAuthorizations] = useState<ToolAuthorization[]>([]);
  const [isLoading, setIsLoading] = useState(!toolFromList);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [connectionForm, setConnectionForm] = useState(EMPTY_CONNECTION_FORM);
  const [mappingForm, setMappingForm] = useState(EMPTY_MAPPING_FORM);
  const [expandedMetadata, setExpandedMetadata] = useState(false);
  const [authorizationServerMetadata, setAuthorizationServerMetadata] = useState<any | null>(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // Edit pops state
  const [showEditNamePop, setShowEditNamePop] = useState(false);
  const [showEditDescriptionPop, setShowEditDescriptionPop] = useState(false);
  const [showEditUrlPop, setShowEditUrlPop] = useState(false);
  const [showEditCommandPop, setShowEditCommandPop] = useState(false);
  const [showEditScopesPop, setShowEditScopesPop] = useState(false);

  const isHttpTool = tool?.type === 'http';
  const isStdioTool = tool?.type === 'stdio';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 1500);
  };

  // Track which toolId has been handled to avoid re-fetching after deletion
  const handledToolIdRef = useRef<string | null>(toolFromList ? (toolId ?? null) : null);

  // Load tool details from API on mount or toolId change (not when toolFromList disappears)
  useEffect(() => {
    if (!toolId) return;
    const fromList = toolFromList;
    if (fromList) {
      setTool(fromList);
      handledToolIdRef.current = toolId;
      return;
    }
    if (handledToolIdRef.current === toolId) return;
    handledToolIdRef.current = toolId;
    setIsLoading(true);
    loadToolDetails(toolId).then((loadedTool) => {
      setTool(loadedTool);
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId, loadToolDetails]);

  // Load scopes, clients, and authorizations when tool is available
  useEffect(() => {
    if (tool && toolId) {
      if (tool.type === 'http') {
        loadToolScopes(toolId).then((loadedScopes) => {
          setScopes(loadedScopes);
          refreshScopeMappings(toolId, loadedScopes);
        });
        loadToolAuthorizations(toolId).then(setAuthorizations);
      } else {
        setScopes([]);
        setScopeMappings([]);
        setAuthorizations([]);
      }

      loadToolClients(toolId).then(setClients);
    }
  }, [tool, toolId, loadToolScopes, loadToolClients, loadToolAuthorizations]);

  useEffect(() => {
    setMappingForm((current) => ({
      ...current,
      scopeId: scopes.some((scope) => scope.id === current.scopeId) ? current.scopeId : scopes[0]?.id || '',
      connectionId: clients.some((client) => client.id === current.connectionId) ? current.connectionId : clients[0]?.id || '',
    }));
  }, [scopes, clients]);

  const stdioCommandParts = useMemo(() => {
    if (!tool || tool.type !== 'stdio') {
      return [];
    }

    return [tool.cmd, ...(tool.args ?? [])].filter(
      (part): part is string => Boolean(part),
    );
  }, [tool]);

  const quoteArg = (value: string): string => {
    if (/^[a-zA-Z0-9._/@:=+-]+$/.test(value)) {
      return value;
    }

    return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
  };

  const formatCommand = (parts: string[]): string =>
    parts.map((part) => quoteArg(part)).join(' ');

  const refreshClients = async () => {
    if (!toolId) return;
    const loadedClients = await loadToolClients(toolId);
    setClients(loadedClients);
  };

  const refreshScopeMappings = async (serverId: string, nextScopes = scopes) => {
    if (nextScopes.length === 0) {
      setScopeMappings([]);
      return;
    }

    const mappingsByScope = await Promise.all(
      nextScopes.map((scope) =>
        ToolsService.McpRegistryController_listMappings({ serverId, scopeId: scope.id }).catch((error) => {
          console.error(`Failed to load mappings for scope ${scope.id}:`, error);
          return [] as ToolScopeMapping[];
        }),
      ),
    );
    setScopeMappings(mappingsByScope.flat());
  };

  // Save handlers
  const handleSaveName = async ({ name }: { name: string }): Promise<boolean> => {
    if (!tool) return false;
    try {
      const updated = await updateTool(tool.id, { name });
      if (updated) {
        setTool(updated);
        setShowEditNamePop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update name:', err);
      showError(err);
      return false;
    }
  };

  const handleSaveDescription = async ({ description }: { description: string }): Promise<boolean> => {
    if (!tool) return false;
    try {
      const updated = await updateTool(tool.id, { description });
      if (updated) {
        setTool(updated);
        setShowEditDescriptionPop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update description:', err);
      showError(err);
      return false;
    }
  };

  const handleSaveUrl = async ({ url }: { url: string }): Promise<boolean> => {
    if (!tool) return false;
    try {
      const updated = await updateTool(tool.id, { url });
      if (updated) {
        setTool(updated);
        setShowEditUrlPop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update URL:', err);
      showError(err);
      return false;
    }
  };

  const handleSaveCommand = async ({ cmd, args }: { cmd: string; args: string[] }): Promise<boolean> => {
    if (!tool) return false;
    try {
      const updated = await updateTool(tool.id, { cmd, args });
      if (updated) {
        setTool(updated);
        setShowEditCommandPop(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update command:', err);
      showError(err);
      return false;
    }
  };

  const handleSaveScopes = async ({
    scopesToCreate,
    scopesToDelete,
  }: {
    scopesToCreate: Array<{ id: string; description: string }>;
    scopesToDelete: string[];
  }): Promise<boolean> => {
    if (!tool) return false;
    try {
      // Delete scopes
      for (const scopeId of scopesToDelete) {
        await ToolsService.McpRegistryController_deleteScope({ serverId: tool.id, scopeId });
      }

      // Create scopes
      if (scopesToCreate.length > 0) {
        await ToolsService.McpRegistryController_createScopes({ serverId: tool.id, body: scopesToCreate });
      }

      // Reload scopes
      const updatedScopes = await loadToolScopes(tool.id);
      setScopes(updatedScopes);
      await refreshScopeMappings(tool.id, updatedScopes);
      setShowEditScopesPop(false);
      return true;
    } catch (err) {
      console.error('Failed to update scopes:', err);
      showError(err);
      return false;
    }
  };

  const handleCreateConnection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tool) return;

    setIsSavingConnection(true);
    try {
      await ToolsService.McpRegistryController_createConnection({
        serverId: tool.id,
        body: {
          friendlyName: connectionForm.friendlyName.trim(),
          providedId: connectionForm.providedId.trim(),
          clientId: connectionForm.clientId.trim(),
          clientSecret: connectionForm.clientSecret,
          authorizeUrl: connectionForm.authorizeUrl.trim(),
          tokenUrl: connectionForm.tokenUrl.trim(),
        },
      });
      setConnectionForm(EMPTY_CONNECTION_FORM);
      await refreshClients();
      showToast('Downstream OAuth connection added', 'success');
    } catch (err) {
      showError(err);
    } finally {
      setIsSavingConnection(false);
    }
  };

  const handleCreateMapping = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tool) return;

    setIsSavingMapping(true);
    try {
      await ToolsService.McpRegistryController_createMapping({
        serverId: tool.id,
        body: {
          scopeId: mappingForm.scopeId,
          connectionId: mappingForm.connectionId,
          downstreamScope: mappingForm.downstreamScope.trim(),
        },
      });
      setMappingForm((current) => ({ ...current, downstreamScope: '' }));
      await refreshScopeMappings(tool.id);
      showToast('Scope mapping added', 'success');
    } catch (err) {
      showError(err);
    } finally {
      setIsSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!tool) return;

    try {
      await ToolsService.McpRegistryController_deleteMapping({ mappingId });
      await refreshScopeMappings(tool.id);
      showToast('Scope mapping removed', 'success');
    } catch (err) {
      showError(err);
    }
  };

  // Discover and load authorization server metadata from the tool URL
  useEffect(() => {
    const prUrlString = tool?.url;

    if (!prUrlString) {
      setAuthorizationServerMetadata(null);
      return;
    }

    const abortController = new AbortController();

    const loadAuthorizationServerMetadata = async () => {
      try {
        const prUrl = new URL(prUrlString);
        const prMetadataUrl = new URL(
          `/.well-known/oauth-protected-resource${prUrl.pathname}`,
          prUrl.origin,
        );

        const prMetadataResponse = await fetch(prMetadataUrl.toString(), {
          signal: abortController.signal,
        });

        if (!prMetadataResponse.ok) {
          setAuthorizationServerMetadata(null);
          return;
        }
        
        const prMetadata = await prMetadataResponse.json() as ProtectedResourceMetadata;
        const asUrlString = prMetadata.authorization_servers?.[0];

        if (!asUrlString) {
          setAuthorizationServerMetadata(null);
          return;
        }
        const asUrl = new URL(asUrlString);

        const asMetadataUrl = new URL(`${asUrl.origin}/.well-known/oauth-authorization-server${asUrl.pathname}`)
        const asMetadataResponse = await fetch(asMetadataUrl, {
          signal: abortController.signal,
        });

        if (!asMetadataResponse.ok) {
          setAuthorizationServerMetadata(null);
          return;
        }

        const asMetadata = await asMetadataResponse.json();
        setAuthorizationServerMetadata(asMetadata);
      } catch (error) {
        console.error(error)
        if ((error as Error).name === 'AbortError') {
          return;
        }
        setAuthorizationServerMetadata(null);
      }
    };

    loadAuthorizationServerMetadata();

    return () => {
      abortController.abort();
    };
  }, [tool?.url]);

  // Set document title (browser tab)
  useDocumentTitle({ tool: { name: tool?.name } });

  // Set section title for IosShell
  useEffect(() => {
    if (!tool) {
      setSectionTitle('Tool');
      return;
    }
    setSectionTitle(tool.name);
  }, [tool, setSectionTitle]);

  // Loading state
  if (isLoading) {
    return (
      <div className="tool-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Loading tool...</Text>
        </Stack>
      </div>
    );
  }

  // If tool not found
  if (!tool) {
    return (
      <div className="tool-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Tool not found</Text>
          <Button variant="secondary" onClick={() => navigate('/tools')}>
            Back to tools
          </Button>
        </Stack>
      </div>
    );
  }
  const tags: DataRowTag[] = [
    { label: 'MCP Server', color: 'blue' },
  ];

  if (tool.type === 'http') {
    tags.push({ label: 'remote', color: 'green' });
  } else {
    tags.push({ label: 'stdio', color: 'orange' });
  }

  return (
    <div className="tool-detail-page">

      {/* Meta */}
      <DataRowContainer className="tool-detail-page__section">
        <DataRow
          leading={<Avatar name={tool.name} />}
          tags={tags}
          topRight={<Text size="1" tone="muted">{elapsedTime(tool.updatedAt)}</Text>}
        >
          {/* No need to display name as it already is the title of the page */}
          <Text as="span" weight="normal" tone="muted" size="3">
            {`${tool.providedId} `}
          </Text>
          <Text as="span" tone="muted" style="mono">
            #{tool.id.slice(0, 6)}
          </Text>

          {/* Description */}
          <Text>
            {tool.description}
          </Text>

          {/* Auth Server Metadata (collapsible) */}
          {authorizationServerMetadata ? (
            <DataRow
              onClick={() => setExpandedMetadata(!expandedMetadata)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Text as="span" weight="medium" size="3">
                  Auth Server Metadata
                </Text>
                <Text size="2" tone="muted">
                  {expandedMetadata ? '(tap to collapse)' : '(tap to expand)'}
                </Text>
              </div>
              {expandedMetadata && (
                <div className="tool-detail-page__metadata">
                  <pre>
                    {JSON.stringify(authorizationServerMetadata, null, 2)}
                  </pre>
                </div>
              )}
            </DataRow>
          ) : (
            <Text tone="muted" size="2">
              Authorization Server metadata not found
            </Text>
          )}
        </DataRow>
      </DataRowContainer>

      {/* Name */}
      <DataRowContainer title="Name" className="tool-detail-page__section">
        <DataRow onClick={() => setShowEditNamePop(true)}>
          <Text size="2">{tool.name}</Text>
          <Text size="1" tone="muted">tap to edit</Text>
        </DataRow>
      </DataRowContainer>

      {/* Description */}
      <DataRowContainer title="Description" className="tool-detail-page__section">
        <DataRow onClick={() => setShowEditDescriptionPop(true)}>
          <Text size="2">{tool.description}</Text>
          <Text size="1" tone="muted">tap to edit</Text>
        </DataRow>
      </DataRowContainer>


      {/* URL */}
      {isHttpTool && tool.url ? (
        <DataRowContainer title="Server URL" className="tool-detail-page__section">
          <DataRow onClick={() => setShowEditUrlPop(true)}>
            <Text as="div" size="2" style="mono" className="tool-detail-page__url">
              {tool.url}
            </Text>
            <Text size='1' tone='muted'>tap to edit</Text>
          </DataRow>
        </DataRowContainer >
      ) : null
      }

      {/* Command (stdio tools) */}
      {isStdioTool && (
        <DataRowContainer title="Command" className="tool-detail-page__section">
          <DataRow onClick={() => setShowEditCommandPop(true)}>
            <Text size="2" style="mono">{tool.cmd}</Text>
            {tool.args && tool.args.length > 0 && (
              <Text size="2" tone="muted" style="mono">
                Args: {tool.args.join(' ')}
              </Text>
            )}
            <Text size="1" tone="muted">tap to edit</Text>
          </DataRow>
        </DataRowContainer>
      )}

      {
        isHttpTool && tool.url && (
          <DataRowContainer title="Configure" className="tool-detail-page__section">
             {/* Inspector Command */}
             <DataRow onClick={() => copyToClipboard(`npx @modelcontextprotocol/inspector --transport http --server-url ${tool.url}`)}>
               <Text weight="medium" size="3">
                 Inspector Command
               </Text>
               <Text size="2" tone="muted">
                 Run this command to start the MCP inspector:
               </Text>
               <Text as="div" style='mono'>
                 {`npx @modelcontextprotocol/inspector --transport http --server-url ${tool.url}`}
                 <Text size='1' tone='muted'>tap to copy</Text>
               </Text>
             </DataRow>
             {/* Codex Command */}
             <DataRow onClick={() => copyToClipboard(`codex mcp add ${tool.providedId} --url ${tool.url}`)}>
               <Text weight="medium" size="3">
                 Codex
               </Text>
               <Text size="2" tone="muted">
                 Run this command to add this MCP server to Codex:
               </Text>
               <Text as="div" style='mono'>
                 {`codex mcp add ${tool.providedId} --url ${tool.url}`}
                 <Text size='1' tone='muted'>tap to copy</Text>
               </Text>
             </DataRow>
             {/* Claude Code Command */}
             <DataRow onClick={() => copyToClipboard(`claude mcp add ${tool.providedId} --transport http ${tool.url}`)}>
               <Text weight="medium" size="3">
                 Claude Code
               </Text>
               <Text as="div" style='mono'>
                 {`claude mcp add ${tool.providedId} --transport http ${tool.url}`}
                 <Text size='1' tone='muted'>tap to copy</Text>
               </Text>
             </DataRow>
          </DataRowContainer>
        )
      }

      {isStdioTool && stdioCommandParts.length > 0 && (
        <DataRowContainer title="Configure" className="tool-detail-page__section">
          <DataRow
            onClick={() =>
              copyToClipboard(
                formatCommand([
                  'npx',
                  '@modelcontextprotocol/inspector',
                  '--transport',
                  'stdio',
                  ...stdioCommandParts,
                ]),
              )
            }
          >
            <Text weight="medium" size="3">
              Inspector Command
            </Text>
            <Text size="2" tone="muted">
              Run this command to start the MCP inspector:
            </Text>
            <Text style="mono">
              {formatCommand([
                'npx',
                '@modelcontextprotocol/inspector',
                '--transport',
                'stdio',
                ...stdioCommandParts,
              ])}
              <Text size="1" tone="muted">tap to copy</Text>
            </Text>
          </DataRow>

          <DataRow
            onClick={() =>
              copyToClipboard(
                formatCommand(['codex', 'mcp', 'add', tool.providedId, ...stdioCommandParts]),
              )
            }
          >
            <Text weight="medium" size="3">
              Codex
            </Text>
            <Text style="mono">
              {formatCommand(['codex', 'mcp', 'add', tool.providedId, ...stdioCommandParts])}
              <Text size="1" tone="muted">tap to copy</Text>
            </Text>
          </DataRow>

          <DataRow
            onClick={() =>
              copyToClipboard(
                formatCommand(['claude', 'mcp', 'add', tool.providedId, '--', ...stdioCommandParts]),
              )
            }
          >
            <Text weight="medium" size="3">
              Claude Code
            </Text>
            <Text style="mono">
              {formatCommand(['claude', 'mcp', 'add', tool.providedId, '--', ...stdioCommandParts])}
              <Text size="1" tone="muted">tap to copy</Text>
            </Text>
          </DataRow>
        </DataRowContainer>
      )}

      {/* Scopes (Permissions) */}
      {isHttpTool && (
        <DataRowContainer title="Scopes" className="tool-detail-page__section">
          <DataRow onClick={() => setShowEditScopesPop(true)}>
            {scopes.length > 0 ? (
              <Stack spacing="1">
                {scopes.map(scope => (
                  <div key={scope.id}>
                    <Text size="2" style="mono" weight="medium">{scope.id}</Text>
                    <Text size="2" tone="muted">{scope.description}</Text>
                  </div>
                ))}
              </Stack>
            ) : (
              <Text tone="muted" size="2">
                No scopes configured
              </Text>
            )}
            <Text size="1" tone="muted">tap to edit</Text>
          </DataRow>
        </DataRowContainer>
      )}

      {isHttpTool && (
        <Card padding="5" className="tool-detail-page__oauth-panel">
          <div className="tool-detail-page__panel-header">
            <Stack spacing="1">
              <Text size="3" weight="semibold">Downstream OAuth</Text>
              <Text size="1" tone="muted">
                Connect this MCP server to a downstream provider and translate Taico scopes into provider scopes.
              </Text>
            </Stack>
            <Chip color={clients.length > 0 ? 'green' : 'gray'}>
              {clients.length} {clients.length === 1 ? 'connection' : 'connections'}
            </Chip>
          </div>

          <div className="tool-detail-page__oauth-grid">
            <section className="tool-detail-page__oauth-card" aria-label="Add downstream OAuth connection">
              <Stack spacing="3">
                <Stack spacing="1">
                  <Text size="2" weight="semibold">Add connection</Text>
                  <Text size="1" tone="muted">Register downstream OAuth client credentials for this HTTP MCP tool.</Text>
                </Stack>

                <form className="tool-detail-page__form" onSubmit={handleCreateConnection}>
                  <label className="tool-detail-page__field">
                    <span>Name</span>
                    <input
                      required
                      value={connectionForm.friendlyName}
                      onChange={(event) => setConnectionForm((current) => ({ ...current, friendlyName: event.target.value }))}
                      placeholder="GitHub production"
                    />
                  </label>
                  <label className="tool-detail-page__field">
                    <span>Provided ID</span>
                    <input
                      required
                      value={connectionForm.providedId}
                      onChange={(event) => setConnectionForm((current) => ({ ...current, providedId: event.target.value }))}
                      placeholder="github-prod"
                    />
                  </label>
                  <label className="tool-detail-page__field">
                    <span>Client ID</span>
                    <input
                      required
                      value={connectionForm.clientId}
                      onChange={(event) => setConnectionForm((current) => ({ ...current, clientId: event.target.value }))}
                      placeholder="OAuth client ID"
                    />
                  </label>
                  <label className="tool-detail-page__field">
                    <span>Client secret</span>
                    <input
                      required
                      type="password"
                      value={connectionForm.clientSecret}
                      onChange={(event) => setConnectionForm((current) => ({ ...current, clientSecret: event.target.value }))}
                      placeholder="OAuth client secret"
                    />
                  </label>
                  <label className="tool-detail-page__field tool-detail-page__field--wide">
                    <span>Authorization URL</span>
                    <input
                      required
                      type="url"
                      value={connectionForm.authorizeUrl}
                      onChange={(event) => setConnectionForm((current) => ({ ...current, authorizeUrl: event.target.value }))}
                      placeholder="https://provider.example/oauth/authorize"
                    />
                  </label>
                  <label className="tool-detail-page__field tool-detail-page__field--wide">
                    <span>Token URL</span>
                    <input
                      required
                      type="url"
                      value={connectionForm.tokenUrl}
                      onChange={(event) => setConnectionForm((current) => ({ ...current, tokenUrl: event.target.value }))}
                      placeholder="https://provider.example/oauth/token"
                    />
                  </label>
                  <Button type="submit" disabled={isSavingConnection} className="tool-detail-page__form-action">
                    {isSavingConnection ? 'Adding...' : 'Add connection'}
                  </Button>
                </form>
              </Stack>
            </section>

            <section className="tool-detail-page__oauth-card" aria-label="Map scopes">
              <Stack spacing="3">
                <Stack spacing="1">
                  <Text size="2" weight="semibold">Map scopes</Text>
                  <Text size="1" tone="muted">Route requested Taico scopes to the downstream OAuth scopes needed by the provider.</Text>
                </Stack>

                <form className="tool-detail-page__form" onSubmit={handleCreateMapping}>
                  <label className="tool-detail-page__field tool-detail-page__field--wide">
                    <span>Taico scope</span>
                    <select
                      required
                      value={mappingForm.scopeId}
                      onChange={(event) => setMappingForm((current) => ({ ...current, scopeId: event.target.value }))}
                      disabled={scopes.length === 0}
                    >
                      {scopes.length === 0 ? <option value="">Create a Taico scope first</option> : null}
                      {scopes.map((scope) => (
                        <option key={scope.id} value={scope.id}>{scope.id}</option>
                      ))}
                    </select>
                  </label>
                  <label className="tool-detail-page__field tool-detail-page__field--wide">
                    <span>Connection</span>
                    <select
                      required
                      value={mappingForm.connectionId}
                      onChange={(event) => setMappingForm((current) => ({ ...current, connectionId: event.target.value }))}
                      disabled={clients.length === 0}
                    >
                      {clients.length === 0 ? <option value="">Add a connection first</option> : null}
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.friendlyName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="tool-detail-page__field tool-detail-page__field--wide">
                    <span>Downstream scope</span>
                    <input
                      required
                      value={mappingForm.downstreamScope}
                      onChange={(event) => setMappingForm((current) => ({ ...current, downstreamScope: event.target.value }))}
                      placeholder="repo:read"
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={isSavingMapping || scopes.length === 0 || clients.length === 0}
                    className="tool-detail-page__form-action"
                  >
                    {isSavingMapping ? 'Mapping...' : 'Add mapping'}
                  </Button>
                </form>
              </Stack>
            </section>
          </div>

          <div className="tool-detail-page__oauth-lists">
            <section>
              <Text size="2" weight="semibold">Connections</Text>
              <div className="tool-detail-page__compact-list">
                {clients.length === 0 ? (
                  <Text size="2" tone="muted">No downstream OAuth connections yet.</Text>
                ) : clients.map((client) => (
                  <div className="tool-detail-page__compact-row" key={client.id}>
                    <div>
                      <Text size="2" weight="medium">{client.friendlyName}</Text>
                      <Text size="1" tone="muted" style="mono">{client.clientId}</Text>
                    </div>
                    <Chip color={client.clientSecret ? 'blue' : 'gray'}>
                      {client.clientSecret ? 'secret set' : 'no secret'}
                    </Chip>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <Text size="2" weight="semibold">Scope mappings</Text>
              <div className="tool-detail-page__compact-list">
                {scopeMappings.length === 0 ? (
                  <Text size="2" tone="muted">No scope mappings configured.</Text>
                ) : scopeMappings.map((mapping) => {
                  const client = clients.find((candidate) => candidate.id === mapping.connectionId);
                  return (
                    <div className="tool-detail-page__compact-row" key={mapping.id}>
                      <div>
                        <Text size="2" weight="medium" style="mono">{mapping.scopeId} {'->'} {mapping.downstreamScope}</Text>
                        <Text size="1" tone="muted">{client?.friendlyName ?? mapping.connectionId}</Text>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteMapping(mapping.id)}>
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </Card>
      )}

      {isStdioTool && (
        <Text tone="muted" size="2">
          STDIO servers do not expose OAuth scopes.
        </Text>
      )}



      {/* Authorizations */}
      {isHttpTool && (
        <DataRowContainer title="Authorizations" className="tool-detail-page__section">
          {authorizations.length === 0 ? (
            <DataRow>
              <Text tone="muted" size="2">
                No active authorizations
              </Text>
            </DataRow>
          ) : (
            [...authorizations]
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map(auth => {
                const statusDisplay = getAuthStatusDisplay(auth.status);
                const lastUpdatedAt = elapsedTime(auth.updatedAt);

              return (
                <DataRow key={auth.id}>
                  {/* Client name */}
                  <Text weight="medium" size="3">
                    {auth.mcpAuthorizationFlow.clientName || 'Unknown Client'}
                  </Text>

                  {/* Actor connection info */}
                  {auth.actor && (
                    <Text size="2" tone="muted">
                      @{auth.actor.slug} updated {lastUpdatedAt}
                    </Text>
                  )}

                  {/* Status tag */}
                  <div style={{ marginTop: '4px' }}>
                    <Chip color={statusDisplay.color}>
                      {statusDisplay.label}
                    </Chip>
                  </div>

                </DataRow>
              );
            })
          )}
        </DataRowContainer>
      )}

      {/* Delete */}
      <DeleteWithConfirmation
        className="tool-detail-page__actions"
        onDelete={async () => {
          const success = await deleteTool(tool.id);
          if (success) {
            navigate('/tools');
          } else {
            showError('Failed to delete tool');
          }
        }}
      />

      {/* Back button */}
      <DataRowContainer className="tool-detail-page__actions">
        <Button
          size="lg"
          variant="secondary"
          onClick={() => navigate('/tools')}
        >
          Back to Tools
        </Button>
      </DataRowContainer>

      {/* Copied toast */}
      <div className={`tool-detail-page__toast ${showCopiedToast ? 'tool-detail-page__toast--visible' : ''}`}>
        Copied!
      </div>

      {/* Edit Pops */}
      {showEditNamePop && tool && (
        <EditToolNamePop
          initialValue={tool.name}
          onCancel={() => setShowEditNamePop(false)}
          onSave={handleSaveName}
        />
      )}
      {showEditDescriptionPop && tool && (
        <EditToolDescriptionPop
          initialValue={tool.description}
          onCancel={() => setShowEditDescriptionPop(false)}
          onSave={handleSaveDescription}
        />
      )}
      {showEditUrlPop && tool && isHttpTool && tool.url && (
        <EditToolUrlPop
          initialValue={tool.url}
          onCancel={() => setShowEditUrlPop(false)}
          onSave={handleSaveUrl}
        />
      )}
      {showEditCommandPop && tool && isStdioTool && (
        <EditToolCommandPop
          initialCmd={tool.cmd || ''}
          initialArgs={tool.args || []}
          onCancel={() => setShowEditCommandPop(false)}
          onSave={handleSaveCommand}
        />
      )}
      {showEditScopesPop && tool && isHttpTool && (
        <EditToolScopesPop
          toolId={tool.id}
          initialScopes={scopes}
          onCancel={() => setShowEditScopesPop(false)}
          onSave={handleSaveScopes}
        />
      )}
    </div >
  );
}
