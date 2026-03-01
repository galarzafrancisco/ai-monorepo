import { useState, useEffect, useRef } from 'react';

interface UseDraftStateOptions<T> {
  key: string;
  defaultValue: T;
  debounceMs?: number;
}

function loadDraftFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.error('Error loading draft from localStorage:', error);
  }

  return fallback;
}

export function useDraftState<T>({ key, defaultValue, debounceMs = 500 }: UseDraftStateOptions<T>) {
  const defaultValueRef = useRef(defaultValue);

  useEffect(() => {
    defaultValueRef.current = defaultValue;
  }, [defaultValue]);

  // Initialize state from localStorage or default
  const [state, setState] = useState<T>(() => loadDraftFromStorage(key, defaultValue));

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Reload when localStorage key changes (for entity-scoped drafts)
  useEffect(() => {
    setState(loadDraftFromStorage(key, defaultValueRef.current));
  }, [key]);

  // Save to localStorage with debouncing
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error('Error saving draft to localStorage:', error);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state, key, debounceMs]);

  // Function to clear the draft
  const clearDraft = () => {
    try {
      localStorage.removeItem(key);
      setState(defaultValueRef.current);
    } catch (error) {
      console.error('Error clearing draft from localStorage:', error);
    }
  };

  return [state, setState, clearDraft] as const;
}
