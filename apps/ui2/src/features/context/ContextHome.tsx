import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DataRowContainer } from "../../ui/primitives";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useContextCtx } from "./ContextProvider";
import { ContextBlockRow } from "./ContextBlockRow";
import "./ContextHome.css";

export function ContextHome(): JSX.Element {
  const { setSectionTitle, blocks, isLoading, error } = useContextCtx();
  const navigate = useNavigate();

  console.log(`blocks`)
  console.log(blocks)

  // Set document title (browser tab)
  useDocumentTitle();

  // Set page title
  useEffect(() => {
    setSectionTitle("Context Blocks");
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

  return (
    <DataRowContainer>
      {blocks.map((block) => (
        <ContextBlockRow
          key={block.id}
          blockSummary={block}
          onClick={() => navigate(`/context/block/${block.id}`)}
        />
      ))}
    </DataRowContainer>
  );
}