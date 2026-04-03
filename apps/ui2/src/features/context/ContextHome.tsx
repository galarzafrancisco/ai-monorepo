import { useEffect, useState } from "react";
import type { BlockSearchResultDto } from "@taico/client/v2";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useContextCtx } from "./ContextProvider";
import { ContextBlockTree } from "./ContextBlockTree";
import { ContextService } from "./api";
import "./ContextHome.css";

export function ContextHome(): JSX.Element {
  const { setSectionTitle, blocks, isLoading, error } = useContextCtx();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BlockSearchResultDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Set document title (browser tab)
  useDocumentTitle();

  // Set page title
  useEffect(() => {
    setSectionTitle("Context Blocks");
  }, [setSectionTitle]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const nextResults = await ContextService.ContextController_searchBlocks({
          query: trimmedQuery,
          limit: 20,
        });
        if (!isCancelled) {
          setResults(nextResults);
        }
      } catch (searchError) {
        if (!isCancelled) {
          setResults([]);
          console.error("Failed to search context blocks:", searchError);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

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
      <section className="context-home__search" aria-label="Search context blocks">
        <input
          type="search"
          className="context-home__search-input"
          placeholder="Search context blocks..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query.trim() ? (
          <div className="context-home__results" role="status" aria-live="polite">
            {isSearching ? <p className="context-home__results-status">Searching...</p> : null}
            {!isSearching && results.length === 0 ? (
              <p className="context-home__results-status">No matching context blocks</p>
            ) : null}
            {!isSearching && results.length > 0 ? (
              <ul className="context-home__results-list">
                {results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      className="context-home__result-row"
                      onClick={() => navigate(`/context/block/${result.id}`)}
                    >
                      <span className="context-home__result-title">{result.title}</span>
                      <span className="context-home__result-score">{Math.round(result.score * 100)}% match</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
      <ContextBlockTree blocks={blocks} onOpenBlock={(blockId) => navigate(`/context/block/${blockId}`)} />
    </div>
  );
}
