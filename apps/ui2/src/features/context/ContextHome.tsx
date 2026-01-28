import { useEffect } from "react";
import { useContextCtx } from "./ContextProvider";
import { useContextBlocks } from "./useContextBlocks";
import { ContextBlockRow } from "./ContextBlockRow";
import "./ContextHome.css";

export function ContextHome(): JSX.Element {
  const { setSectionTitle } = useContextCtx();
  const { blocks, isLoading, error } = useContextBlocks();

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
    <div className="context-home">
      {blocks.map((block) => (
        <ContextBlockRow key={block.id} block={block} />
      ))}
    </div>
  );
}