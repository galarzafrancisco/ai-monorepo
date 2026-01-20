import React, { createContext, useContext, useMemo, useState } from "react";
import { useTools } from "./useTools";
import type { Tool, ToolScope, ToolClient } from "./types";

// Shape this to match what pages/layout need.
export type ToolsContextValue = {
  tools: Tool[];
  isLoading: boolean;
  error: string | null;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  loadToolDetails: (serverId: string) => Promise<Tool | null>;
  loadToolScopes: (serverId: string) => Promise<ToolScope[]>;
  loadToolClients: (serverId: string) => Promise<ToolClient[]>;
  loadClientDetails: (connectionId: string) => Promise<ToolClient | null>;
};

const ToolsContext = createContext<ToolsContextValue | null>(null);

export function ToolsProvider({ children }: { children: React.ReactNode }) {
  const {
    tools,
    isLoading,
    error,
    loadToolDetails,
    loadToolScopes,
    loadToolClients,
    loadClientDetails,
  } = useTools();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<ToolsContextValue>(() => {
    return {
      tools,
      isLoading,
      error,
      sectionTitle,
      setSectionTitle,
      loadToolDetails,
      loadToolScopes,
      loadToolClients,
      loadClientDetails,
    };
  }, [
    tools,
    isLoading,
    error,
    sectionTitle,
    setSectionTitle,
    loadToolDetails,
    loadToolScopes,
    loadToolClients,
    loadClientDetails,
  ]);

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useToolsCtx(): ToolsContextValue {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error("useToolsCtx must be used within <ToolsProvider>");
  return ctx;
}
