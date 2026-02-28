import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Text } from "../../ui/primitives";
import { MetaService, MetaTagResponseDto } from "@taico/client";
import "./TagSearchPop.css";

type TagSearchPopProps = {
  onCancel?: () => void;
  onSave: (tag: MetaTagResponseDto) => Promise<boolean>;
  existingTags: { id: string }[]; // Tags already on the task (only id is used for filtering)
};

export function TagSearchPop({ onCancel, onSave, existingTags }: TagSearchPopProps) {
  const [allTags, setAllTags] = useState<MetaTagResponseDto[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Load all tags on mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await MetaService.metaControllerGetAllTags();
        setAllTags(tags);
      } catch (err) {
        console.error('Failed to load tags:', err);
      } finally {
        setIsLoadingTags(false);
      }
    };
    loadTags();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter out tags already on the task and rank based on query
  const filteredTags = useMemo(() => {
    const existingTagIds = new Set(existingTags.map(t => t.id));
    const availableTags = allTags.filter(t => !existingTagIds.has(t.id));

    if (!query.trim()) {
      return availableTags;
    }

    const lowerQuery = query.toLowerCase().trim();

    // Score each tag
    const scored = availableTags.map(tag => {
      let score = 0;

      // Check name
      if (tag.name.toLowerCase().startsWith(lowerQuery)) {
        score += 100; // Highest priority for prefix match
      } else if (tag.name.toLowerCase().includes(lowerQuery)) {
        score += 50;
      }

      return { tag, score };
    });

    // Filter out zero scores and sort by score descending
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.tag);
  }, [allTags, existingTags, query]);

  // Check if we can create a new tag with this query
  const canCreateNew = useMemo(() => {
    if (!query.trim()) return false;
    const lowerQuery = query.toLowerCase().trim();
    // Check if any existing tag has this exact name (case-insensitive)
    return !allTags.some(t => t.name.toLowerCase() === lowerQuery);
  }, [query, allTags]);

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredTags.length, query, canCreateNew]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const totalItems = filteredTags.length + (canCreateNew ? 1 : 0);
      if (highlightedIndex < totalItems) {
        const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
        if (highlightedEl) {
          highlightedEl.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }, [highlightedIndex, filteredTags.length, canCreateNew]);

  const submitTag = useCallback(async (tag: MetaTagResponseDto): Promise<boolean> => {
    if (isSaving) {
      return false;
    }

    setIsSaving(true);
    try {
      const didSave = await onSave(tag);
      if (didSave) {
        onCancel?.();
      }
      return didSave;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onCancel, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }

    const totalItems = filteredTags.length + (canCreateNew ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        if (totalItems === 0) {
          return;
        }
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < totalItems - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        if (totalItems === 0) {
          return;
        }
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex < filteredTags.length) {
          void submitTag(filteredTags[highlightedIndex]);
        } else if (canCreateNew && highlightedIndex === filteredTags.length) {
          void submitTag(buildNewTag(query));
        }
        break;
      case 'Escape':
        e.preventDefault();
        onCancel?.();
        break;
    }
  }, [canCreateNew, filteredTags, highlightedIndex, onCancel, query, submitTag]);

  async function handleSave(): Promise<boolean> {
    const totalItems = filteredTags.length + (canCreateNew ? 1 : 0);
    if (totalItems === 0) {
      return false;
    }

    if (highlightedIndex < filteredTags.length) {
      const tag = filteredTags[highlightedIndex];
      if (!tag) {
        return false;
      }

      return submitTag(tag);
    }

    if (canCreateNew && highlightedIndex === filteredTags.length) {
      return submitTag(buildNewTag(query));
    }

    return false;
  }

  return (
    <PopShell
      title="Add Tag"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="tag-search-pop">
        <input
          ref={inputRef}
          type="text"
          className="tag-search-pop__input"
          placeholder="Search or create tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="tag-search-pop__list" ref={listRef} role="listbox" aria-label="Available tags">
          {isLoadingTags ? (
            <div className="tag-search-pop__empty">
              <Text tone="muted">Loading tags...</Text>
            </div>
          ) : filteredTags.length === 0 && !canCreateNew ? (
            <div className="tag-search-pop__empty">
              <Text tone="muted">No tags found</Text>
            </div>
          ) : (
            <>
              {filteredTags.map((tag, index) => (
                <button
                  key={tag.id}
                  type="button"
                  role="option"
                  aria-selected={index === highlightedIndex}
                  className={`tag-search-pop__item ${index === highlightedIndex ? 'tag-search-pop__item--highlighted' : ''}`}
                  onClick={() => void submitTag(tag)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  disabled={isSaving}
                >
                  <div className="tag-search-pop__tag-badge" style={{ backgroundColor: tag.color || '#999' }}>
                    {tag.name}
                  </div>
                </button>
              ))}
              {canCreateNew && (
                <button
                  type="button"
                  role="option"
                  aria-selected={highlightedIndex === filteredTags.length}
                  className={`tag-search-pop__item tag-search-pop__item--create ${highlightedIndex === filteredTags.length ? 'tag-search-pop__item--highlighted' : ''}`}
                  onClick={() => void submitTag(buildNewTag(query))}
                  onMouseEnter={() => setHighlightedIndex(filteredTags.length)}
                  disabled={isSaving}
                >
                  <Text size="2" tone="muted">Create new tag:</Text>
                  <div className="tag-search-pop__tag-badge" style={{ backgroundColor: '#999' }}>
                    {query.trim()}
                  </div>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </PopShell>
  );
}

function buildNewTag(query: string): MetaTagResponseDto {
  return {
    id: '',
    name: query.trim(),
    color: undefined,
    createdAt: '',
    updatedAt: '',
  };
}
