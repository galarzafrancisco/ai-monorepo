import { useCallback, useState } from 'react';

/** Open/closed state for a rail, remembered per browser under `storageKey`. */
export function useRailOpen(storageKey: string, defaultOpen: boolean, legacyOpenValues: string[] = []) {
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) return defaultOpen;
      return stored === 'open' || legacyOpenValues.includes(stored);
    } catch {
      return defaultOpen;
    }
  });
  const change = useCallback((next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(storageKey, next ? 'open' : 'closed'); } catch { /* Storage may be unavailable. */ }
  }, [storageKey]);
  return [open, change] as const;
}
