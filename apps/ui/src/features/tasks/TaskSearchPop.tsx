import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Text, DataRowTag } from "../../ui/primitives";
import { TasksService } from "./api";
import { TaskStatus, TASKS_STATUS } from "./const";
import type { Task } from "./types";
import "./TaskSearchPop.css";

type TaskSearchPopProps = {
  onCancel?: () => void;
  onSave: (task: Task) => Promise<boolean>;
  excludeTaskIds: string[]; // Tasks to exclude from results (e.g., current task and existing dependencies)
};

type TaskSearchResult = {
  id: string;
  name: string;
  score: number;
};

export function TaskSearchPop({ onCancel, onSave, excludeTaskIds }: TaskSearchPopProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<TaskSearchResult[]>([]);
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
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      // Invalidate any outstanding requests before clearing
      searchRequestIdRef.current = searchRequestIdRef.current + 1;
      setSearchResults([]);
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
        const results = await TasksService.TasksController_searchTasks({
          query: trimmedQuery,
          limit: 20,
        });
        if (searchRequestIdRef.current !== requestId) {
          return;
        }
        setSearchResults(results ?? []);
      } catch (err) {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }
        setSearchError(
          err instanceof Error ? err.message : 'Failed to search tasks',
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

  // Filter out excluded tasks
  const filteredResults = useMemo(() => {
    const excludeSet = new Set(excludeTaskIds);
    return searchResults.filter(result => !excludeSet.has(result.id));
  }, [searchResults, excludeTaskIds]);

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredResults.length, query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const submitTask = useCallback(async (taskResult: TaskSearchResult): Promise<boolean> => {
    if (isSaving) {
      return false;
    }

    setIsSaving(true);
    try {
      // Fetch full task details
      const fullTask = await TasksService.TasksController_getTask({ id: taskResult.id });
      const didSave = await onSave(fullTask);
      if (didSave) {
        onCancel?.();
      }
      return didSave;
    } catch (err) {
      console.error('Failed to fetch task details:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onCancel, onSave]);

  const submitHighlightedTask = useCallback(() => {
    if (filteredResults.length === 0) {
      return;
    }

    const taskResult = filteredResults[highlightedIndex];
    if (!taskResult) {
      return;
    }

    void submitTask(taskResult);
  }, [filteredResults, highlightedIndex, submitTask]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        if (filteredResults.length === 0) {
          return;
        }
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        if (filteredResults.length === 0) {
          return;
        }
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        submitHighlightedTask();
        break;
      case 'Escape':
        e.preventDefault();
        onCancel?.();
        break;
    }
  }, [filteredResults, submitHighlightedTask, onCancel]);

  async function handleSave(): Promise<boolean> {
    if (filteredResults.length === 0) {
      return false;
    }

    const taskResult = filteredResults[highlightedIndex];
    if (!taskResult) {
      return false;
    }

    return submitTask(taskResult);
  }

  return (
    <PopShell
      title="Add Dependency"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="task-search-pop">
        <input
          ref={inputRef}
          type="text"
          className="task-search-pop__input"
          placeholder="Search tasks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="task-search-pop__list" ref={listRef} role="listbox" aria-label="Tasks">
          {filteredResults.length === 0 ? (
            <div className="task-search-pop__empty">
              <Text tone="muted">
                {query.trim()
                  ? (isSearching
                      ? 'Searching tasks...'
                      : (searchError || 'No tasks found'))
                  : 'Type to search for tasks'}
              </Text>
            </div>
          ) : (
            filteredResults.map((taskResult, index) => (
              <button
                key={taskResult.id}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                className={`task-search-pop__item ${index === highlightedIndex ? 'task-search-pop__item--highlighted' : ''}`}
                onClick={() => void submitTask(taskResult)}
                onMouseEnter={() => setHighlightedIndex(index)}
                disabled={isSaving}
              >
                <div className="task-search-pop__item-info">
                  <Text weight="medium" size="2">{taskResult.name}</Text>
                  <Text tone="muted" size="1" style="mono">#{taskResult.id.slice(0, 6)}</Text>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </PopShell>
  );
}
