import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToolsCtx } from './ToolsProvider';
import { Text, Stack, Button, Avatar, DataRow, DataRowTag, DataRowContainer } from '../../ui/primitives';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { Tool, ToolClient } from './types';
import './ClientDetailPage.css';

export function ClientDetailPage() {
  const { toolId, clientId } = useParams<{ toolId: string; clientId: string }>();
  const navigate = useNavigate();
  const { tools, setSectionTitle, loadToolDetails, loadClientDetails } = useToolsCtx();

  const toolFromList = tools.find(t => t.id === toolId);
  const [tool, setTool] = useState<Tool | null>(toolFromList || null);
  const [client, setClient] = useState<ToolClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load tool if not in list
  useEffect(() => {
    if (!toolFromList && toolId) {
      loadToolDetails(toolId).then(setTool);
    } else if (toolFromList) {
      setTool(toolFromList);
    }
  }, [toolId, toolFromList, loadToolDetails]);

  // Load client details
  useEffect(() => {
    if (clientId) {
      setIsLoading(true);
      loadClientDetails(clientId).then((loadedClient) => {
        setClient(loadedClient);
        setIsLoading(false);
      });
    }
  }, [clientId, loadClientDetails]);

  // Set section title
  useEffect(() => {
    if (!client) {
      setSectionTitle('Client');
      return;
    }
    setSectionTitle(client.friendlyName);
  }, [client, setSectionTitle]);

  // Loading state
  if (isLoading) {
    return (
      <div className="client-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Loading client...</Text>
        </Stack>
      </div>
    );
  }

  // If client not found
  if (!client) {
    return (
      <div className="client-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Client not found</Text>
          <Button variant="secondary" onClick={() => navigate(`/tools/tool/${toolId}/clients`)}>
            Back to clients
          </Button>
        </Stack>
      </div>
    );
  }

  const statusTags = getClientStatusTags(client);

  return (
    <div className="client-detail-page">

      {/* Meta */}
      <DataRowContainer className="client-detail-page__section">
        <DataRow
          leading={<Avatar size="sm" name={client.friendlyName} />}
          tags={statusTags}
          topRight={<Text size="1" tone="muted">{elapsedTime(client.updatedAt)}</Text>}
        >
          <Text as="span" weight="medium" size="3">
            {client.friendlyName}
          </Text>
          <Text as="span" tone="muted" style="mono">
            {` #${client.id.slice(0, 6)}`}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Client ID */}
      <DataRowContainer className="client-detail-page__section">
        <DataRow>
          <Text as="span" weight="medium" size="3">
            Client ID
          </Text>
          <Text size="2" style="mono" className="client-detail-page__value">
            {client.clientId}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Connection ID */}
      <DataRowContainer className="client-detail-page__section">
        <DataRow>
          <Text as="span" weight="medium" size="3">
            Connection ID
          </Text>
          <Text size="2" style="mono" className="client-detail-page__value">
            {client.id}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Server ID */}
      <DataRowContainer className="client-detail-page__section">
        <DataRow>
          <Text as="span" weight="medium" size="3">
            Server ID
          </Text>
          <Text size="2" style="mono" className="client-detail-page__value">
            {client.serverId}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Authorization URL */}
      <DataRowContainer className="client-detail-page__section">
        <DataRow>
          <Text as="span" weight="medium" size="3">
            Authorization URL
          </Text>
          <Text size="2" style="mono" className="client-detail-page__value">
            {client.authorizeUrl}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Token URL */}
      <DataRowContainer className="client-detail-page__section">
        <DataRow>
          <Text as="span" weight="medium" size="3">
            Token URL
          </Text>
          <Text size="2" style="mono" className="client-detail-page__value">
            {client.tokenUrl}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Client Secret Status */}
      <DataRowContainer className="client-detail-page__section">
        <DataRow>
          <Text as="span" weight="medium" size="3">
            Client Secret
          </Text>
          <Text size="2" tone="muted">
            {client.clientSecret ? 'Configured (hidden)' : 'Not configured'}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Registration Date */}
      <DataRowContainer className="client-detail-page__section">
        <DataRow>
          <Text as="span" weight="medium" size="3">
            Registration Date
          </Text>
          <Text size="2" tone="muted">
            {new Date(client.createdAt).toLocaleString()}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Last Updated */}
      <DataRowContainer className="client-detail-page__section">
        <DataRow>
          <Text as="span" weight="medium" size="3">
            Last Updated
          </Text>
          <Text size="2" tone="muted">
            {new Date(client.updatedAt).toLocaleString()}
          </Text>
        </DataRow>
      </DataRowContainer>

      {/* Actions */}
      <DataRowContainer className="client-detail-page__actions">
        <Button
          size="lg"
          variant="secondary"
          onClick={() => navigate(`/tools/tool/${toolId}/clients`)}
        >
          Back to Clients
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => navigate(`/tools/tool/${toolId}`)}
        >
          Back to Tool
        </Button>
      </DataRowContainer>
    </div>
  );
}

function getClientStatusTags(client: ToolClient): DataRowTag[] {
  const tags: DataRowTag[] = [];

  // OAuth configuration status
  if (client.authorizeUrl && client.tokenUrl) {
    tags.push({ label: 'OAuth Ready', color: 'green' });
  } else {
    tags.push({ label: 'Incomplete', color: 'orange' });
  }

  // Client secret status
  if (client.clientSecret) {
    tags.push({ label: 'Secret Set', color: 'blue' });
  }

  return tags;
}
