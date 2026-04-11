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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<Actor[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
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

  const filteredActors = useMemo(() => {
    if (query.trim()) {
      return searchResults ?? [];
    }
    return actors;
  }, [actors, query, searchResults]);

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredActors.length, query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const submitActor = useCallback(async (actor: Actor): Promise<boolean> => {
    if (isSaving) {
      return false;
    }

    setIsSaving(true);
    try {
      const didSave = await onSave(actor);
      if (didSave) {
        onCancel?.();
      }
      return didSave;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onCancel, onSave]);

  const submitHighlightedActor = useCallback(() => {
    if (filteredActors.length === 0) {
      return;
    }

    const actor = filteredActors[highlightedIndex];
    if (!actor) {
      return;
    }

    void submitActor(actor);
  }, [filteredActors, highlightedIndex, submitActor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        if (filteredActors.length === 0) {
          return;
        }
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredActors.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        if (filteredActors.length === 0) {
          return;
        }
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        submitHighlightedActor();
        break;
    }
  }, [filteredActors, submitHighlightedActor]);

  async function handleSave(): Promise<boolean> {
    if (filteredActors.length === 0) {
      return false;
    }

    const actor = filteredActors[highlightedIndex];
    if (!actor) {
      return false;
    }

    return submitActor(actor);
  }

  return (
    <PopShell
      title="Assign Task"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="actor-search-pop">
        <input
          ref={inputRef}
          type="text"
          className="actor-search-pop__input"
          placeholder="Search by name or @slug..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="actor-search-pop__list" ref={listRef} role="listbox" aria-label="Assignees">
          {filteredActors.length === 0 ? (
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
            filteredActors.map((actor, index) => (
              <button
                key={actor.id}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                className={`actor-search-pop__item ${index === highlightedIndex ? 'actor-search-pop__item--highlighted' : ''}`}
                onClick={() => void submitActor(actor)}
                onMouseEnter={() => setHighlightedIndex(index)}
                disabled={isSaving}
              >
                <Avatar name={actor.displayName} size="sm" src={actor.avatarUrl || undefined} />
                <div className="actor-search-pop__item-info">
                  <Text weight="medium" size="2">{actor.displayName}</Text>
                  <Text tone="muted" size="1">@{actor.slug} · {actor.type}</Text>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </PopShell>
  );
}
