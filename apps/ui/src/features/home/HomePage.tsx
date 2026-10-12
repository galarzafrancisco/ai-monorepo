import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Chip, ListRow, Row, Stack, Text } from "../../ui/primitives";
import { useHomeCtx } from "./HomeProvider";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { SearchService } from "./search-api";
import { useAuth } from "../../auth/AuthContext";
import { useWalkthrough } from "../walkthrough/useWalkthrough";
import { WebAuthenticationService } from "../../auth/api";
import type { GlobalSearchResultDto, SearchResultType } from "@taico/client/v2";
import "./HomePage.css";

/** Every kind of result, in the order the filter shows them. */
const RESULT_TYPES: { type: SearchResultType; label: string }[] = [
  { type: "task", label: "Tasks" },
  { type: "context_block", label: "Context" },
  { type: "thread", label: "Threads" },
  { type: "agent", label: "Agents" },
  { type: "tool", label: "Tools" },
  { type: "project", label: "Projects" },
];
const EXCLUDED_TYPES_KEY = "home.search.excludedTypes";

/** The kinds of result the person switched off, remembered between visits. */
function readExcludedTypes(): SearchResultType[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(EXCLUDED_TYPES_KEY) ?? "[]");
    const known = RESULT_TYPES.map((entry) => entry.type);
    return Array.isArray(stored) ? known.filter((type) => stored.includes(type)) : [];
  } catch {
    return [];
  }
}

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
  const latestRequestRef = useRef(0);
  const [excludedTypes, setExcludedTypes] = useState<SearchResultType[]>(readExcludedTypes);

  const toggleType = (type: SearchResultType) => {
    setExcludedTypes((current) => {
      const next = current.includes(type)
        ? current.filter((entry) => entry !== type)
        : [...current, type];
      // At least one kind stays on; a search of nothing is never what was meant.
      if (next.length === RESULT_TYPES.length) {
        return current;
      }
      try {
        localStorage.setItem(EXCLUDED_TYPES_KEY, JSON.stringify(next));
      } catch {
        // The choice still applies for this visit.
      }
      return next;
    });
  };

  useDocumentTitle();

  useEffect(() => {
    setSectionTitle("");
    // Auto-focus the search input on mount
    searchInputRef.current?.focus();
  }, [setSectionTitle]);

  const performSearch = useCallback(async (searchQuery: string) => {
    // Answers can arrive out of order; only the latest search may set the results.
    const requestId = ++latestRequestRef.current;
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
        // Omitted when nothing is switched off, so new kinds of result show up by default.
        types:
          excludedTypes.length > 0
            ? RESULT_TYPES.map((entry) => entry.type).filter((type) => !excludedTypes.includes(type))
            : undefined,
      });
      if (requestId !== latestRequestRef.current) {
        return;
      }
      setResults(searchResults);
      setSelectedIndex(-1);
      // Reset result refs array when results change
      resultRefs.current = [];
    } catch (err) {
      console.error("Search failed:", err);
      if (requestId === latestRequestRef.current) {
        setResults([]);
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsSearching(false);
      }
    }
  }, [excludedTypes]);

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
      case "thread":
        return "yellow";
      case "agent":
        return "green";
      case "project":
        return "orange";
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
      case "thread":
        return "Thread";
      case "agent":
        return "Agent";
      case "project":
        return "Project";
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

          <div className="home-search-filters" role="group" aria-label="Kinds of result to search">
            {RESULT_TYPES.map(({ type, label }) => {
              const isOn = !excludedTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`home-search-filter ${isOn ? "home-search-filter--on" : ""}`}
                  aria-pressed={isOn}
                  onClick={() => toggleType(type)}
                >
                  {label}
                </button>
              );
            })}
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
                              {result.excerpt ? (
                                <Text size="1" tone="muted" className="home-search-result-excerpt">
                                  {result.matchedOn === "comment"
                                    ? `${result.commentAuthor ?? "Comment"}: `
                                    : ""}
                                  {result.excerpt}
                                </Text>
                              ) : null}
                            </div>
                            <div className="home-search-result-meta">
                              <Chip color={getTypeColor(result.type)}>
                                {getTypeLabel(result.type)}
                              </Chip>
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
