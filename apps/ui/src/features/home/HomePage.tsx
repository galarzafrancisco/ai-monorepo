import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Chip, ListRow, Row, Stack, Text } from "../../ui/primitives";
import { useHomeCtx } from "./HomeProvider";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { SearchService } from "./search-api";
import { useAuth } from "../../auth/AuthContext";
import { useWalkthrough } from "../walkthrough/useWalkthrough";
import { WebAuthenticationService } from "../../auth/api";
import type { GlobalSearchResultDto } from "@taico/client/v2";
import "./HomePage.css";

function WalkthroughBanner() {
  const { user, refreshAuth } = useAuth();
  const { status } = useWalkthrough();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [isAllSetLoading, setIsAllSetLoading] = useState(false);

  if (user?.onboardingDisplayMode !== 'BANNER' || dismissed) return null;

  const completedCount = status?.completedCount ?? 0;
  const totalCount = status?.totalCount ?? 7;
  const remaining = totalCount - completedCount;

  const handleCardClick = () => navigate('/walkthrough');

  const handleNotNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
  };

  const handleAllSet = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsAllSetLoading(true);
      await WebAuthenticationService.webAuthControllerMarkWalkthroughSeen();
      await refreshAuth();
    } catch (err) {
      console.error('Failed to hide walkthrough:', err);
      setIsAllSetLoading(false);
    }
  };

  return (
    <div className="home-walkthrough-wrap">
      <div
        className="home-walkthrough-card"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      >
        <div className="home-walkthrough-dots" aria-hidden="true">
          {Array.from({ length: totalCount }).map((_, i) => (
            <span
              key={i}
              className={`home-walkthrough-dot${i < completedCount ? ' home-walkthrough-dot--done' : ''}`}
            />
          ))}
        </div>

        <div className="home-walkthrough-body">
          <Text size="2" weight="semibold">
            {remaining === 0 ? 'Setup complete!' : `${remaining} step${remaining === 1 ? '' : 's'} to go`}
          </Text>
          <Text size="1" tone="muted">
            {completedCount} of {totalCount} setup steps completed · Click to continue
          </Text>
        </div>

        <div className="home-walkthrough-actions">
          <button className="home-walkthrough-not-now" onClick={handleNotNow}>
            Not now
          </button>
          <button
            className="home-walkthrough-all-set"
            onClick={handleAllSet}
            disabled={isAllSetLoading}
          >
            {isAllSetLoading ? '…' : "I'm all set"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { setSectionTitle } = useHomeCtx();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResultDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle("");
    // Auto-focus the search input on mount
    searchInputRef.current?.focus();
  }, [setSectionTitle]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await SearchService.GlobalSearchController_search({
        query: searchQuery,
        limit: 20,
      });
      setResults(searchResults);
      setSelectedIndex(-1);
      // Reset result refs array when results change
      resultRefs.current = [];
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const newIndex = prev < results.length - 1 ? prev + 1 : prev;
        // Scroll the selected result into view
        setTimeout(() => {
          resultRefs.current[newIndex]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 0);
        return newIndex;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const newIndex = prev > 0 ? prev - 1 : 0;
        // Scroll the selected result into view
        setTimeout(() => {
          resultRefs.current[newIndex]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 0);
        return newIndex;
      });
    } else if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex].url);
    }
  };

  const handleResultClick = (url: string) => {
    navigate(url);
  };

  const getTypeColor = (type: string): "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "purple" => {
    switch (type) {
      case "task":
        return "blue";
      case "context_block":
        return "purple";
      case "agent":
        return "green";
      case "project":
        return "orange";
      case "tag":
        return "yellow";
      case "tool":
        return "red";
      default:
        return "gray";
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case "task":
        return "Task";
      case "context_block":
        return "Context";
      case "agent":
        return "Agent";
      case "project":
        return "Project";
      case "tag":
        return "Tag";
      case "tool":
        return "Tool";
      default:
        return type;
    }
  };

  return (
    <div className="home-page">
      <WalkthroughBanner />
    <div className="home-page-search">
      <div className="home-search-container">
        <Stack spacing="6" align="center">
          <Stack spacing="3" align="center">
            <Text size="6" weight="bold" className="home-search-title">
              Find anything
            </Text>
            <Text size="3" tone="muted" className="home-search-subtitle">
              Search across tasks, context, agents, tools, and more
            </Text>
          </Stack>

          <div className="home-search-box">
            <input
              ref={searchInputRef}
              type="text"
              className="home-search-input"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          {query && (
            <Card className="home-search-results">
              <Stack spacing="2">
                {isSearching && (
                  <Text tone="muted" size="2">
                    Searching...
                  </Text>
                )}

                {!isSearching && results.length === 0 && (
                  <Text tone="muted" size="2">
                    No results found
                  </Text>
                )}

                {!isSearching && results.length > 0 && (
                  <>
                    <Text size="1" tone="muted">
                      {results.length} {results.length === 1 ? "result" : "results"}
                    </Text>
                    <div className="home-search-results-list">
                      {results.map((result, index) => (
                        <div
                          key={result.id}
                          ref={(el) => {
                            resultRefs.current[index] = el;
                          }}
                        >
                          <ListRow
                            interactive
                            onClick={() => handleResultClick(result.url)}
                            className={`home-search-result-row ${
                              index === selectedIndex ? "home-search-result-row--selected" : ""
                            }`}
                          >
                            <div className="home-search-result-main">
                              <Text weight="medium" size="3">
                                {result.title}
                              </Text>
                            </div>
                            <div className="home-search-result-meta">
                              <Chip color={getTypeColor(result.type)}>
                                {getTypeLabel(result.type)}
                              </Chip>
                              <Text size="1" tone="muted">
                                {Math.round(result.score * 100)}% match
                              </Text>
                            </div>
                          </ListRow>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Stack>
            </Card>
          )}

          <Row spacing="2" className="home-quick-links">
            <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
              Tasks
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/threads")}>
              Threads
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/agents")}>
              Agents
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/context")}>
              Context
            </Button>
          </Row>
        </Stack>
      </div>
    </div>
    </div>
  );
}
