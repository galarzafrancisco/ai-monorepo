import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { useActorsCtx } from "./ActorsProvider";
import { Avatar, Text } from "../../ui/primitives";
import type { Actor } from "./types";
import "./ActorSearchPop.css";

type ActorSearchPopProps = {
  onCancel?: () => void;
  onSave: (actor: Actor) => Promise<boolean>;
};

export function ActorSearchPop({ onCancel, onSave }: ActorSearchPopProps) {
  const { actors } = useActorsCtx();
  const [query, setQuery] = useState("");
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter and rank actors based on query
  const filteredActors = useMemo(() => {
    if (!query.trim()) {
      return actors;
    }

    const lowerQuery = query.toLowerCase().trim();

    // Score each actor
    const scored = actors.map(actor => {
      let score = 0;

      // Check slug
      if (actor.slug.toLowerCase().startsWith(lowerQuery)) {
        score += 100; // Highest priority for slug prefix match
      } else if (actor.slug.toLowerCase().includes(lowerQuery)) {
        score += 50;
      }

      // Check displayName words
      const nameParts = actor.displayName.toLowerCase().split(' ');
      for (const part of nameParts) {
        if (part.startsWith(lowerQuery)) {
          score += 80; // High priority for name prefix match
        } else if (part.includes(lowerQuery)) {
          score += 30;
        }
      }

      return { actor, score };
    });

    // Filter out zero scores and sort by score descending
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.actor);
  }, [actors, query]);

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredActors.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredActors.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredActors[highlightedIndex]) {
          setSelectedActor(filteredActors[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (selectedActor) {
          setSelectedActor(null);
        }
        break;
    }
  }, [filteredActors, highlightedIndex, selectedActor]);

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
            <Avatar name={selectedActor.displayName} size="md" />
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
              {filteredActors.length === 0 ? (
                <div className="actor-search-pop__empty">
                  <Text tone="muted">No actors found</Text>
                </div>
              ) : (
                filteredActors.map((actor, index) => (
                  <div
                    key={actor.id}
                    className={`actor-search-pop__item ${index === highlightedIndex ? 'actor-search-pop__item--highlighted' : ''}`}
                    onClick={() => handleSelectActor(actor)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <Avatar name={actor.displayName} size="sm" />
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
