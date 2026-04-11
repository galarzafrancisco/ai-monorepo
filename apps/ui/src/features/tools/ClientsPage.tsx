import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Avatar, DataRow, Text, DataRowContainer, DataRowTag, Button } from "../../ui/primitives";
import { useToolsCtx } from "./ToolsProvider";
import { Tool, ToolClient } from "./types";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import './ClientsPage.css';

export function ClientsPage() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { tools, setSectionTitle, loadToolDetails, loadToolClients } = useToolsCtx();

  const toolFromList = tools.find(t => t.id === toolId);
  const [tool, setTool] = useState<Tool | null>(toolFromList || null);
  const [clients, setClients] = useState<ToolClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load tool if not in list
  useEffect(() => {
    if (!toolFromList && toolId) {
      loadToolDetails(toolId).then(setTool);
    } else if (toolFromList) {
      setTool(toolFromList);
    }
  }, [toolId, toolFromList, loadToolDetails]);

  // Load clients when tool is available
  useEffect(() => {
    if (toolId) {
      setIsLoading(true);
      loadToolClients(toolId).then((loadedClients) => {
        // Sort by updatedAt descending
        const sorted = [...loadedClients].sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setClients(sorted);
        setIsLoading(false);
      });
    }
  }, [toolId, loadToolClients]);

  // Set page title
  useEffect(() => {
    setSectionTitle(tool ? `${tool.name} Clients` : "Clients");
  }, [tool, setSectionTitle]);

  if (isLoading) {
    return (
      <DataRowContainer>
        <DataRow leading={<Avatar name="..." size="lg" />}>
          <Text tone="muted">Loading clients...</Text>
        </DataRow>
      </DataRowContainer>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="clients-page">
        <DataRowContainer>
          <DataRow leading={<Avatar name="?" size="lg" />}>
            <Text tone="muted">No clients found for this tool</Text>
          </DataRow>
        </DataRowContainer>
        <DataRowContainer className="clients-page__actions">
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

  return (
    <div className="clients-page">
      <DataRowContainer>
        {clients.map(client => (
          <ClientRow
            key={client.id}
            client={client}
            onClick={() => navigate(`/tools/tool/${toolId}/clients/${client.id}`)}
          />
        ))}
      </DataRowContainer>
      <DataRowContainer className="clients-page__actions">
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

function ClientRow({ client, onClick }: { client: ToolClient; onClick?: () => void }): React.JSX.Element {
  const tags: DataRowTag[] = getClientStatusTags(client);

  return (
    <DataRow
      leading={<Avatar name={client.friendlyName} size="lg" />}
      topRight={elapsedTime(client.updatedAt)}
      tags={tags}
      onClick={onClick}
    >
      <Text className="pre" style="mono" tone="muted">
        {client.clientId}
      </Text>
      <Text weight="bold" size="3" tone="default">
        {client.friendlyName}
      </Text>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Text tone="muted" size="2">
          {client.authorizeUrl}
        </Text>
      </div>
    </DataRow>
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
