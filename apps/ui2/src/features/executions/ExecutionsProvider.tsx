import React, { createContext, useContext, useMemo, useState } from "react";

export type ExecutionsContextValue = {
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
};

const ExecutionsContext = createContext<ExecutionsContextValue | null>(null);

export function ExecutionsProvider({ children }: { children: React.ReactNode }) {
  const [sectionTitle, setSectionTitle] = useState("Work Queue");

  const value = useMemo<ExecutionsContextValue>(() => {
    return {
      sectionTitle,
      setSectionTitle,
    };
  }, [sectionTitle]);

  return <ExecutionsContext.Provider value={value}>{children}</ExecutionsContext.Provider>;
}

export function useExecutionsCtx(): ExecutionsContextValue {
  const ctx = useContext(ExecutionsContext);
  if (!ctx) throw new Error("useExecutionsCtx must be used within <ExecutionsProvider>");
  return ctx;
}
