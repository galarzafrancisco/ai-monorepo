import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useContextCtx } from "./ContextProvider";
import { ContextBlockTree } from "./ContextBlockTree";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DataRow, Text } from "../../ui/primitives";
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import "./ContextHome.css";

export function ContextHome(): JSX.Element {
  const { setSectionTitle, blocks, isLoading, error } = useContextCtx();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [searchQuery, setSearchQuery] = useState("");

  // Set document title (browser tab)
  useDocumentTitle();

  // Set page title
  useEffect(() => {
    setSectionTitle("Context");
  }, [setSectionTitle]);

  if (isLoading) {
    return <div className="context-home__loading">Loading context blocks...</div>;
  }

  if (error) {
    return <div className="context-home__error">Error: {error}</div>;
  }

  if (blocks.length === 0) {
    return <div className="context-home__empty">No context blocks found</div>;
  }

  if (isDesktop) {
    return (
      <DesktopContextHome
        blocks={blocks}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onOpenBlock={(blockId) => navigate(`/context/block/${blockId}`)}
      />
    );
  }

  return (
    <div className="context-home">
      <ContextBlockTree blocks={blocks} onOpenBlock={(blockId) => navigate(`/context/block/${blockId}`)} />
    </div>
  );
}

function DesktopContextHome({
  blocks,
  searchQuery,
  onSearchQueryChange,
  onOpenBlock,
}: {
  blocks: ReturnType<typeof useContextCtx>["blocks"];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenBlock: (blockId: string) => void;
}): JSX.Element {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredBlocks = useMemo(() => {
    if (!normalizedQuery) {
      return blocks.slice(0, 18);
    }

    return blocks.filter((block) => {
      const fields = [
        block.title,
        block.createdBy || "",
        block.id,
        ...block.tags.map((tag) => tag.name),
      ];

      return fields.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [blocks, normalizedQuery]);

  return (
    <div className="context-home-desktop">
      <div className="context-home-desktop__hero">
        <Text as="div" size="6" weight="bold" className="context-home-desktop__title">
          Blocks
        </Text>
      </div>

      <div className="context-home-desktop__search-box">
        <input
          type="search"
          className="context-home-desktop__search-input"
          placeholder="Search by title, tag, author, or block id"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </div>

      <div className="context-home-desktop__results">
        {filteredBlocks.length === 0 ? (
          <div className="context-home-desktop__empty">
            <Text as="div" size="3" weight="medium">No matching blocks</Text>
            <Text as="div" size="2" tone="muted">Try a different title, tag, author, or id fragment.</Text>
          </div>
        ) : (
          filteredBlocks.map((block) => (
            <DataRow
              key={block.id}
              className="context-home-desktop__result"
              onClick={() => onOpenBlock(block.id)}
              topRight={<Text as="span" size="2" tone="muted">{elapsedTime(block.updatedAt)}</Text>}
              tags={block.tags.slice(0, 3).map((tag) => ({ label: tag.name }))}
            >
              <div className="context-home-desktop__result-main">
                <div className="row-title">{block.title}</div>
                <div className="row-detail">
                  #{block.id.slice(0, 6)} {block.createdBy || "unknown"}
                </div>
              </div>
            </DataRow>
          ))
        )}
      </div>
    </div>
  );
}
