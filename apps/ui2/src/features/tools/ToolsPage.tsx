import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, DataRow, Text, DataRowContainer, DataRowTag } from "../../ui/primitives";
import { useToolsCtx } from "./ToolsProvider";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { Tool } from "./types";
import { elapsedTime } from "../../shared/helpers/elapsedTime";

export function ToolsPage() {
  const { tools, setSectionTitle, isLoading, error } = useToolsCtx();
  const navigate = useNavigate();

  // Set document title (browser tab)
  useDocumentTitle();

  // Set page title
  useEffect(() => {
    setSectionTitle("All Tools");
  }, [setSectionTitle]);

  if (isLoading && tools.length === 0) {
    return (
      <DataRowContainer>
        <DataRow leading={<Avatar name="..." size="lg" />}>
          <Text tone="muted">Loading tools...</Text>
        </DataRow>
      </DataRowContainer>
    );
  }

  if (error) {
    return (
      <DataRowContainer>
        <DataRow leading={<Avatar name="!" size="lg" />}>
          <Text tone="muted">Error: {error}</Text>
        </DataRow>
      </DataRowContainer>
    );
  }

  if (tools.length === 0) {
    return (
      <DataRowContainer>
        <DataRow leading={<Avatar name="?" size="lg" />}>
          <Text tone="muted">No tools found</Text>
        </DataRow>
      </DataRowContainer>
    );
  }

  return (
    <DataRowContainer>
      {tools.map(tool => (
        <ToolRow
          key={tool.id}
          tool={tool}
          onClick={() => navigate(`/tools/tool/${tool.id}`)}
        />
      ))}
    </DataRowContainer>
  );
}

function ToolRow({ tool, onClick }: { tool: Tool; onClick?: () => void }): JSX.Element {
  const tags: DataRowTag[] = [
    { label: 'MCP Server', color: 'blue' },
  ];

  if (tool.type === 'http') {
    tags.push({ label: 'remote', color: 'green' });
  } else {
    tags.push({ label: 'stdio', color: 'orange' });
  }

  return (
    <DataRow
      leading={<Avatar name={tool.name} size="lg" />}
      topRight={elapsedTime(tool.updatedAt)}
      tags={tags}
      onClick={onClick}
    >
      <Text className="pre" style="mono" tone="muted">
        {tool.providedId}
      </Text>
      <Text weight="bold" size="3" tone="default">
        {tool.name}
      </Text>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Text tone="muted" size="2">
          {tool.description || 'No description'}
        </Text>
      </div>
    </DataRow>
  );
}
