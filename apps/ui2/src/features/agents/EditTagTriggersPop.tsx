import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Text } from "../../ui/primitives";
import type { MetaTagResponseDto } from "@taico/client/v2";
import { MetaService } from "./api";
import "./EditTagTriggersPop.css";

type EditTagTriggersPopProps = {
  initialValue: string[]; // Array of tag IDs
  onCancel?: () => void;
  onSave: (payload: { tagTriggers: string[] }) => Promise<boolean>;
};

export function EditTagTriggersPop({ initialValue, onCancel, onSave }: EditTagTriggersPopProps) {
  const [allTags, setAllTags] = useState<MetaTagResponseDto[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(initialValue)
  );
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Load all tags on mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await MetaService.MetaController_getAllTags({});
        setAllTags(tags);
      } catch (err) {
        console.error('Failed to load tags:', err);
      } finally {
        setIsLoadingTags(false);
      }
    };
    loadTags();
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter and rank tags based on query
  const filteredTags = useMemo(() => {
    if (!query.trim()) {
      return allTags;
    }

    const lowerQuery = query.toLowerCase().trim();

    // Score each tag
    const scored = allTags.map(tag => {
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
  }, [allTags, query]);

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

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const handleCreateNewTag = async () => {
    try {
      const newTag = await MetaService.MetaController_createTag({
        body: {
          name: query.trim(),
        }
      });
      setAllTags(prev => [...prev, newTag]);
      setSelectedTagIds(prev => new Set([...prev, newTag.id]));
      setQuery("");
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = filteredTags.length + (canCreateNew ? 1 : 0);
    if (totalItems === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < totalItems - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex < filteredTags.length) {
          // Toggle the highlighted tag
          toggleTag(filteredTags[highlightedIndex].id);
        } else if (canCreateNew && highlightedIndex === filteredTags.length) {
          // Create new tag
          handleCreateNewTag();
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (query) {
          setQuery("");
        }
        break;
    }
  }, [filteredTags, highlightedIndex, canCreateNew, query]);

  async function handleSave(): Promise<boolean> {
    return onSave({ tagTriggers: Array.from(selectedTagIds) });
  }

  return (
    <PopShell
      title="Edit Tag Triggers"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="edit-tag-triggers-pop__content">
        <Text size="2" tone="muted" className="edit-tag-triggers-pop__description">
          Select which tags will trigger this agent to activate when added to a task ({selectedTagIds.size} selected)
        </Text>

        <input
          ref={inputRef}
          type="text"
          className="edit-tag-triggers-pop__input"
          placeholder="Search or create tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="edit-tag-triggers-pop__list" ref={listRef}>
          {isLoadingTags ? (
            <div className="edit-tag-triggers-pop__empty">
              <Text tone="muted">Loading tags...</Text>
            </div>
          ) : filteredTags.length === 0 && !canCreateNew ? (
            <div className="edit-tag-triggers-pop__empty">
              <Text tone="muted">No tags found</Text>
            </div>
          ) : (
            <>
              {filteredTags.map((tag, index) => (
                <label
                  key={tag.id}
                  className={`edit-tag-triggers-pop__item ${index === highlightedIndex ? 'edit-tag-triggers-pop__item--highlighted' : ''}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTagIds.has(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="edit-tag-triggers-pop__checkbox"
                  />
                  <div
                    className="edit-tag-triggers-pop__tag-badge"
                    style={{ backgroundColor: tag.color || '#999' }}
                  >
                    {tag.name}
                  </div>
                </label>
              ))}
              {canCreateNew && (
                <div
                  className={`edit-tag-triggers-pop__item edit-tag-triggers-pop__item--create ${highlightedIndex === filteredTags.length ? 'edit-tag-triggers-pop__item--highlighted' : ''}`}
                  onClick={handleCreateNewTag}
                  onMouseEnter={() => setHighlightedIndex(filteredTags.length)}
                >
                  <Text size="2" tone="muted">Create new tag:</Text>
                  <div className="edit-tag-triggers-pop__tag-badge" style={{ backgroundColor: '#999' }}>
                    {query.trim()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PopShell>
  );
}
