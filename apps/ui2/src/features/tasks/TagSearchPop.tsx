import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Text, Chip } from "../../ui/primitives";
import { MetaService, MetaTagResponseDto, TagResponseDto } from 'shared';
import "./TagSearchPop.css";

type TagSearchPopProps = {
  onCancel?: () => void;
  onSave: (tag: MetaTagResponseDto) => Promise<boolean>;
  existingTags: TagResponseDto[]; // Tags already on the task (from task response)
  onRemoveTag: (tagId: string) => void; // Handler to remove a tag
};

export function TagSearchPop({ onCancel, onSave, existingTags, onRemoveTag }: TagSearchPopProps) {
  const [allTags, setAllTags] = useState<MetaTagResponseDto[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

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

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        let tagToAdd: MetaTagResponseDto | null = null;
        if (highlightedIndex < filteredTags.length) {
          tagToAdd = filteredTags[highlightedIndex];
        } else if (canCreateNew && highlightedIndex === filteredTags.length) {
          // Create new tag
          tagToAdd = {
            id: '', // Will be assigned by backend
            name: query.trim(),
            color: undefined,
            createdAt: '',
            updatedAt: '',
          };
        }
        if (tagToAdd) {
          await onSave(tagToAdd);
          // Don't clear the search - let user add more tags
        }
        break;
    }
  }, [filteredTags, highlightedIndex, canCreateNew, query, onSave]);

  const handleSelectTag = async (tag: MetaTagResponseDto) => {
    await onSave(tag);
    // Don't clear the search - let user add more tags
  };

  const handleCreateNew = async () => {
    const newTag: MetaTagResponseDto = {
      id: '', // Will be assigned by backend
      name: query.trim(),
      color: undefined,
      createdAt: '',
      updatedAt: '',
    };
    await onSave(newTag);
    // Don't clear the search - let user add more tags
  };

  return (
    <PopShell
      title="Edit Tags"
      onCancel={onCancel}
    >
      <div className="tag-search-pop">
        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          className="tag-search-pop__input"
          placeholder="Search or create tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Dropdown list */}
        <div className="tag-search-pop__list" ref={listRef}>
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
                <div
                  key={tag.id}
                  className={`tag-search-pop__item ${index === highlightedIndex ? 'tag-search-pop__item--highlighted' : ''}`}
                  onClick={() => handleSelectTag(tag)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <Chip>{tag.name}</Chip>
                </div>
              ))}
              {canCreateNew && (
                <div
                  className={`tag-search-pop__item tag-search-pop__item--create ${highlightedIndex === filteredTags.length ? 'tag-search-pop__item--highlighted' : ''}`}
                  onClick={handleCreateNew}
                  onMouseEnter={() => setHighlightedIndex(filteredTags.length)}
                >
                  <Text size="2" tone="muted">Create new tag:</Text>
                  <Chip>{query.trim()}</Chip>
                </div>
              )}
            </>
          )}
        </div>

        {/* Existing tags at bottom */}
        {existingTags.length > 0 && (
          <div className="tag-search-pop__existing">
            <div className="tag-search-pop__existing-list">
              {existingTags.map(tag => (
                <Chip
                  key={tag.id}
                  onRemove={() => onRemoveTag(tag.id)}
                >
                  {tag.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </PopShell>
  );
}
