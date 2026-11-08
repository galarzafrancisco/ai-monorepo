import { useState, useEffect, useRef, useContext } from 'react';
import { DraftScopeContext } from '../context/DraftScopeContext';

interface UseDraftStateOptions<T> {
  key: string;
  defaultValue: T;
  debounceMs?: number;
}

function loadDraftFromStorage<T>(storageKey: string | null, fallback: T): T {
  if (!storageKey) return fallback;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.error('Error loading draft from localStorage:', error);
  }

  return fallback;
}

/**
 * State kept as a draft in localStorage. Drafts belong to the person and
 * workspace (see `DraftScopeContext`): `key` is stored under that scope, and
 * until the scope is known nothing is loaded or saved.
 */
export function useDraftState<T>({ key, defaultValue, debounceMs = 500 }: UseDraftStateOptions<T>) {
  const scope = useContext(DraftScopeContext);
  const storageKey = scope ? `draft:${scope}:${key}` : null;
  const defaultValueRef = useRef(defaultValue);

  useEffect(() => {
    defaultValueRef.current = defaultValue;
  }, [defaultValue]);

  // Initialize state from localStorage or default
  const [state, setState] = useState<T>(() => loadDraftFromStorage(storageKey, defaultValue));

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Reload when the storage key changes (entity-scoped drafts, or the scope resolving)
  useEffect(() => {
    setState(loadDraftFromStorage(storageKey, defaultValueRef.current));
  }, [storageKey]);

  // Save to localStorage with debouncing
  useEffect(() => {
    if (!storageKey) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (error) {
        console.error('Error saving draft to localStorage:', error);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state, storageKey, debounceMs]);

  // Function to clear the draft
  const clearDraft = () => {
    try {
      if (storageKey) localStorage.removeItem(storageKey);
      setState(defaultValueRef.current);
    } catch (error) {
      console.error('Error clearing draft from localStorage:', error);
    }
  };

  return [state, setState, clearDraft] as const;
}
