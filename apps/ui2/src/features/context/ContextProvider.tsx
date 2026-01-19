import React, { createContext, useContext, useMemo, useState } from "react";
// import { useContext } from "./useContext"; // your abstraction hook

// Shape this to match what pages/layout need.
export type ContextContextValue = {
  // isLoading: boolean;
  // error: string | null;
  // isConnected: boolean;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
};

const ContextContext = createContext<ContextContextValue | null>(null);

export function ContextProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: this is where the one websocket connection should be created
  // const { tasks, isLoading, error, isConnected } = useContext();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<ContextContextValue>(() => {
    return {
      // tasks,
      // isLoading,
      // error,
      // isConnected,
      sectionTitle,
      setSectionTitle,
    };
  }, [
    // tasks,
    // isLoading,
    // error,
    // isConnected,
    sectionTitle,
    setSectionTitle,
  ]);

  return <ContextContext.Provider value={value}>{children}</ContextContext.Provider>;
}

export function useContextCtx(): ContextContextValue {
  const ctx = useContext(ContextContext);
  if (!ctx) throw new Error("useContextCtx must be used within <ContextProvider>");
  return ctx;
}
