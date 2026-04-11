import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, DataRow, Text, DataRowContainer, DataRowTag } from "../../ui/primitives";
import { useToolsCtx } from "./ToolsProvider";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { Tool } from "./types";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { NewToolPop } from "./NewToolPop";
import "./ToolsPage.css";

export function ToolsPage() {
  const { tools, setSectionTitle, isLoading, error, createTool } = useToolsCtx();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [showNewToolPop, setShowNewToolPop] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  if (error && tools.length === 0) {
    return (
      <DataRowContainer>
        <DataRow leading={<Avatar name="!" size="lg" />}>
          <Text tone="muted">Error: {error}</Text>
        </DataRow>
      </DataRowContainer>
    );
  }

  const handleNewToolCancel = () => {
    setShowNewToolPop(false);
    setFormError(null);
  };

  const handleNewToolSave = async ({ name, type }: { name: string; type: 'http' | 'stdio' }): Promise<boolean> => {
    setFormError(null);
    try {
      const tool = await createTool({ name, type });
      if (tool) {
        navigate(`/tools/tool/${tool.id}`);
        return true;
      }
      return false;
    } catch (saveError: any) {
      const detail = saveError?.body?.detail ?? saveError?.message ?? 'Failed to create tool';
      setFormError(detail);
      return false;
    }
  };

  return (
    <>
      <DataRowContainer>
        {tools.length === 0 ? (
          <DataRow leading={<Avatar name="?" size="lg" />}>
            <Text tone="muted">No tools found</Text>
          </DataRow>
        ) : (
          tools.map(tool => (
            <ToolRow
              key={tool.id}
              tool={tool}
              onClick={() => navigate(`/tools/tool/${tool.id}`)}
            />
          ))
        )}
      </DataRowContainer>

      <button
        className={`tools-fab ${isDesktop ? 'tools-fab--desktop' : ''}`}
        type="button"
        onClick={() => setShowNewToolPop(true)}
        aria-label="Create new tool"
      >
        {isDesktop ? (
          <>
            <span className="tools-fab__plus">+</span>
            <span className="tools-fab__label">New tool</span>
          </>
        ) : (
          '+'
        )}
      </button>

      {showNewToolPop ? (
        <NewToolPop onCancel={handleNewToolCancel} onSave={handleNewToolSave} error={formError} />
      ) : null}
    </>
  );
}

function ToolRow({ tool, onClick }: { tool: Tool; onClick?: () => void }): React.JSX.Element {
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
