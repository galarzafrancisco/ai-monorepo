import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { useActorsCtx } from "./ActorsProvider";
import { ActorsService } from "./api";
import { Avatar, Text } from "../../ui/primitives";
import type { Actor } from "./types";
import "./ActorSearchPop.css";

type ActorSearchPopProps = {
  onCancel?: () => void;
  onSave: (actor: Actor) => Promise<boolean>;
};

export function ActorSearchPop({ onCancel, onSave }: ActorSearchPopProps) {
  const { actors, isLoading, error, refreshActors } = useActorsCtx();
  const [query, setQuery] = useState("");
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<Actor[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    refreshActors().catch(() => undefined);
  }, [refreshActors]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults(null);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    setIsSearching(true);
    setSearchError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await ActorsService.actorControllerSearchActors(
          trimmedQuery,
          20,
        );
        if (searchRequestIdRef.current !== requestId) {
          return;
        }
        setSearchResults(results ?? []);
      } catch (err) {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }
        setSearchError(
          err instanceof Error ? err.message : 'Failed to search actors',
        );
        setSearchResults([]);
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const displayActors = useMemo(() => {
    if (query.trim()) {
      return searchResults ?? [];
    }
    return actors;
  }, [actors, query, searchResults]);

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [displayActors.length, query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (displayActors.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < displayActors.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (displayActors[highlightedIndex]) {
          setSelectedActor(displayActors[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (selectedActor) {
          setSelectedActor(null);
        }
        break;
    }
  }, [displayActors, highlightedIndex, selectedActor]);

  const handleSelectActor = (actor: Actor) => {
    setSelectedActor(actor);
  };

  const handleClearSelection = () => {
    setSelectedActor(null);
    setQuery("");
    inputRef.current?.focus();
  };

  async function handleSave(): Promise<boolean> {
    if (!selectedActor) {
      return false;
    }
    return onSave(selectedActor);
  }

  return (
    <PopShell
      title="Assign Task"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="actor-search-pop">
        {/* Search input or selected actor display */}
        {selectedActor ? (
          <div className="actor-search-pop__selected" onClick={handleClearSelection}>
            <Avatar name={selectedActor.displayName} size="md" src={selectedActor.avatarUrl || undefined}/>
            <div className="actor-search-pop__selected-info">
              <Text weight="medium" size="3">{selectedActor.displayName}</Text>
              <Text tone="muted" size="2">@{selectedActor.slug}</Text>
            </div>
            <Text tone="muted" size="2" className="actor-search-pop__clear">tap to change</Text>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              className="actor-search-pop__input"
              placeholder="Search by name or @slug..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            {/* Dropdown list */}
            <div className="actor-search-pop__list" ref={listRef}>
              {displayActors.length === 0 ? (
                <div className="actor-search-pop__empty">
                  <Text tone="muted">
                    {query.trim()
                      ? (isSearching
                          ? 'Searching actors...'
                          : (searchError || 'No actors found'))
                      : (isLoading
                          ? 'Loading actors...'
                          : (error || 'No actors found'))}
                  </Text>
                </div>
              ) : (
                displayActors.map((actor, index) => (
                  <div
                    key={actor.id}
                    className={`actor-search-pop__item ${index === highlightedIndex ? 'actor-search-pop__item--highlighted' : ''}`}
                    onClick={() => handleSelectActor(actor)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <Avatar name={actor.displayName} size="sm" src={actor.avatarUrl || undefined} />
                    <div className="actor-search-pop__item-info">
                      <Text weight="medium" size="2">{actor.displayName}</Text>
                      <Text tone="muted" size="1">@{actor.slug} · {actor.type}</Text>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </PopShell>
  );
}
