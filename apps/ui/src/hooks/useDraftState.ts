import { useState, useEffect, useRef } from 'react';

interface UseDraftStateOptions<T> {
  key: string;
  defaultValue: T;
  debounceMs?: number;
}

export function useDraftState<T>({ key, defaultValue, debounceMs = 500 }: UseDraftStateOptions<T>) {
  // Initialize state from localStorage or default
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading draft from localStorage:', error);
    }
    return defaultValue;
  });

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

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
      setState(defaultValue);
    } catch (error) {
      console.error('Error clearing draft from localStorage:', error);
    }
  };

  return [state, setState, clearDraft] as const;
}
