import React, { createContext, useContext, useMemo, useState } from "react";
// import { useWikiroo } from "./useWikiroo"; // your abstraction hook

// Shape this to match what pages/layout need.
export type WikirooContextValue = {
  // isLoading: boolean;
  // error: string | null;
  // isConnected: boolean;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
};

const WikirooContext = createContext<WikirooContextValue | null>(null);

export function WikirooProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: this is where the one websocket connection should be created
  // const { tasks, isLoading, error, isConnected } = useWikiroo();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<WikirooContextValue>(() => {
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

  return <WikirooContext.Provider value={value}>{children}</WikirooContext.Provider>;
}

export function useWikirooCtx(): WikirooContextValue {
  const ctx = useContext(WikirooContext);
  if (!ctx) throw new Error("useWikirooCtx must be used within <WikirooProvider>");
  return ctx;
}
