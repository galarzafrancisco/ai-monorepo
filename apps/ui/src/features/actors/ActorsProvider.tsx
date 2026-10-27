import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
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
  const { user } = useAuth();
  const signedInActorId = user?.actorId ?? null;
  const [actors, setActors] = useState<Actor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Load once someone is signed in, and again whenever that changes. Loading on mount
  // raced the session check: with an expired session (a phone reopening the app) the
  // request failed, nothing retried after sign-in, and runs showed agent ids, not names.
  useEffect(() => {
    if (signedInActorId) void loadActors();
  }, [signedInActorId, loadActors]);

  // If a load still failed (say, offline), retry when the app comes back into view.
  useEffect(() => {
    if (!signedInActorId || !error) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadActors();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [signedInActorId, error, loadActors]);

  const refreshActors = useCallback(async () => {
    await loadActors();
  }, [loadActors]);

  // Signed out, there's nobody to show (and a previous user's list must not linger).
  const value = useMemo<ActorsContextValue>(() => ({
    actors: signedInActorId ? actors : [],
    isLoading,
    error,
    refreshActors,
  }), [signedInActorId, actors, isLoading, error, refreshActors]);

  return <ActorsContext.Provider value={value}>{children}</ActorsContext.Provider>;
}

export function useActorsCtx(): ActorsContextValue {
  const ctx = useContext(ActorsContext);
  if (!ctx) throw new Error("useActorsCtx must be used within <ActorsProvider>");
  return ctx;
}
