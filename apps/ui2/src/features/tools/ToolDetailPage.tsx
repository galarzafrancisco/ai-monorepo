import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToolsCtx } from './ToolsProvider';
import { Text, Stack, Button, Avatar, DataRow, DataRowTag, DataRowContainer, Chip } from '../../ui/primitives';
import { DeleteWithConfirmation } from '../../ui/components';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { Tool, ToolScope, ToolClient, ToolAuthorization } from './types';
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
  const { showError } = useToast();

  // Find tool from context first (for quick load)
  const toolFromList = tools.find(t => t.id === toolId);
  const [tool, setTool] = useState<Tool | null>(toolFromList || null);
  const [scopes, setScopes] = useState<ToolScope[]>([]);
  const [clients, setClients] = useState<ToolClient[]>([]);
  const [authorizations, setAuthorizations] = useState<ToolAuthorization[]>([]);
  const [isLoading, setIsLoading] = useState(!toolFromList);
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
        loadToolScopes(toolId).then(setScopes);
        loadToolAuthorizations(toolId).then(setAuthorizations);
      } else {
        setScopes([]);
        setAuthorizations([]);
      }

      loadToolClients(toolId).then(setClients);
    }
  }, [tool, toolId, loadToolScopes, loadToolClients, loadToolAuthorizations]);

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
        await ToolsService.mcpRegistryControllerDeleteScope(tool.id, scopeId);
      }

      // Create scopes
      if (scopesToCreate.length > 0) {
        await ToolsService.mcpRegistryControllerCreateScopes(tool.id, scopesToCreate);
      }

      // Reload scopes
      const updatedScopes = await loadToolScopes(tool.id);
      setScopes(updatedScopes);
      setShowEditScopesPop(false);
      return true;
    } catch (err) {
      console.error('Failed to update scopes:', err);
      showError(err);
      return false;
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
