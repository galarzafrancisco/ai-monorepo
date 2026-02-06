import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ActorsService } from "./api";
import type { Actor } from "./types";

export type ActorsContextValue = {
  actors: Actor[];
  isLoading: boolean;
  error: string | null;
  refreshActors: () => Promise<void>;
};

const ActorsContext = createContext<ActorsContextValue | null>(null);

export function ActorsProvider({ children }: { children: React.ReactNode }) {
  const [actors, setActors] = useState<Actor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch actors on mount
  const loadActors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ActorsService.actorControllerListActors();
      setActors(response || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actors');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActors();
  }, [loadActors]);

  const refreshActors = useCallback(async () => {
    await loadActors();
  }, [loadActors]);

  const value = useMemo<ActorsContextValue>(() => ({
    actors,
    isLoading,
    error,
    refreshActors,
  }), [actors, isLoading, error, refreshActors]);

  return <ActorsContext.Provider value={value}>{children}</ActorsContext.Provider>;
}

export function useActorsCtx(): ActorsContextValue {
  const ctx = useContext(ActorsContext);
  if (!ctx) throw new Error("useActorsCtx must be used within <ActorsProvider>");
  return ctx;
}
