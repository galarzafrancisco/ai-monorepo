import React, { createContext, useContext, useMemo, useState } from "react";
import { useTools } from "./useTools";
import type { Tool, ToolScope, ToolClient, ToolAuthorization } from "./types";

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
  loadToolAuthorizations: (serverId: string) => Promise<ToolAuthorization[]>;
  loadClientDetails: (connectionId: string) => Promise<ToolClient | null>;
  createTool: (params: { name: string; type: 'http' | 'stdio' }) => Promise<Tool | null>;
  updateTool: (toolId: string, updates: Partial<Tool>) => Promise<Tool | null>;
  deleteTool: (toolId: string) => Promise<boolean>;
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
    loadToolAuthorizations,
    loadClientDetails,
    createTool,
    updateTool,
    deleteTool,
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
      loadToolAuthorizations,
      loadClientDetails,
      createTool,
      updateTool,
      deleteTool,
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
    loadToolAuthorizations,
    loadClientDetails,
    createTool,
    updateTool,
    deleteTool,
  ]);

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}

export function useToolsCtx(): ToolsContextValue {
  const ctx = useContext(ToolsContext);
  if (!ctx) throw new Error("useToolsCtx must be used within <ToolsProvider>");
  return ctx;
}
