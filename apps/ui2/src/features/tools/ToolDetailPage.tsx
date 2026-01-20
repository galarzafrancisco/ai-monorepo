import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToolsCtx } from './ToolsProvider';
import { Text, Stack, Button, Avatar, DataRow, DataRowTag, DataRowContainer } from '../../ui/primitives';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { Tool, ToolScope, ToolClient } from './types';
import './ToolDetailPage.css';

export function ToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { tools, setSectionTitle, loadToolDetails, loadToolScopes, loadToolClients } = useToolsCtx();

  // Find tool from context first (for quick load)
  const toolFromList = tools.find(t => t.id === toolId);
  const [tool, setTool] = useState<Tool | null>(toolFromList || null);
  const [scopes, setScopes] = useState<ToolScope[]>([]);
  const [clients, setClients] = useState<ToolClient[]>([]);
  const [isLoading, setIsLoading] = useState(!toolFromList);
  const [expandedMetadata, setExpandedMetadata] = useState(false);
  const [authorizationServerMetadata, setAuthorizationServerMetadata] = useState<any | null>(null);

  // Load tool details if not in list
  useEffect(() => {
    if (!toolFromList && toolId) {
      setIsLoading(true);
      loadToolDetails(toolId).then((loadedTool) => {
        setTool(loadedTool);
        setIsLoading(false);
      });
    } else if (toolFromList) {
      setTool(toolFromList);
    }
  }, [toolId, toolFromList, loadToolDetails]);

  // Load scopes and clients when tool is available
  useEffect(() => {
    if (tool && toolId) {
      loadToolScopes(toolId).then(setScopes);
      loadToolClients(toolId).then(setClients);
    }
  }, [tool, toolId, loadToolScopes, loadToolClients]);

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

  if (tool.url) {
    tags.push({ label: 'remote', color: 'green' });
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


      {/* URL */}
      {tool.url && (
        <>
          <DataRowContainer title="Server URL" className="tool-detail-page__section">
            <DataRow>
              <Text size="2" style="mono" className="tool-detail-page__url">
                {tool.url}
              </Text>
            </DataRow>
          </DataRowContainer>
        </>
      )}

      {/* Inspector Command */}
      {tool.url && (
        <DataRowContainer title="Configure" className="tool-detail-page__section">
          <DataRow>
            <Text as="span" weight="medium" size="3">
              Inspector Command
            </Text>
            <Text size="2" tone="muted">
              Run this command to start the MCP inspector:
            </Text>
            <Text as='span' style='mono'>
              <div onClick={() => navigator.clipboard.writeText(`npx @modelcontextprotocol/inspector ${tool.url}`)}>
                {`npx @modelcontextprotocol/inspector ${tool.url}`}
              </div>
            </Text>
          </DataRow>
        </DataRowContainer>
      )}

      {/* Scopes (Permissions) */}
      {scopes.length ? (
        <DataRowContainer title="Scopes">
          {scopes.map(scope => (
            <DataRow key={scope.id}>
              <Text size="2" style="mono" weight="medium">{scope.id}</Text>
              <Text size="2" tone="muted">{scope.description}</Text>
            </DataRow>
          ))}
        </DataRowContainer>
      ) : (
        <Text tone="muted" size="2">
          This server doesn't have any permissions configured
        </Text>
      )}



      {/* Clients */}
      <DataRowContainer title="Clients" className="tool-detail-page__section">
        <DataRow
          onClick={() => navigate(`/tools/tool/${tool.id}/clients`)}
        >
          <Text tone="muted" size="2">
            {clients.length === 0
              ? 'No OAuth clients configured'
              : `${clients.length} OAuth client${clients.length === 1 ? '' : 's'} configured`}
          </Text>
          <Text size="2" tone="muted">Tap to view clients</Text>
        </DataRow>
      </DataRowContainer>

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
    </div>
  );
}
