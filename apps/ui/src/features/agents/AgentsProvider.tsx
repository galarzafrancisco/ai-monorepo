import React, { createContext, useContext, useMemo, useState } from "react";
import { useAgents } from "./useAgents";
import type { Agent } from "./types";
import type { CreateAgentDto, PatchAgentDto } from "@taico/client/v2";

// Shape this to match what pages/layout need.
export type AgentsContextValue = {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  loadAgentDetails: (slug: string) => Promise<Agent | null>;
  createAgent: (params: CreateAgentDto) => Promise<Agent | null>;
  updateAgent: (actorId: string, updates: PatchAgentDto) => Promise<Agent | null>;
  deleteAgent: (actorId: string) => Promise<boolean>;
};

const AgentsContext = createContext<AgentsContextValue | null>(null);

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const { agents, isLoading, error, loadAgentDetails, createAgent, updateAgent, deleteAgent } = useAgents();
  const [sectionTitle, setSectionTitle] = useState("");

  // Provide a stable reference to avoid pointless rerenders.
  const value = useMemo<AgentsContextValue>(() => {
    return {
      agents,
      isLoading,
      error,
      sectionTitle,
      setSectionTitle,
      loadAgentDetails,
      createAgent,
      updateAgent,
      deleteAgent,
    };
  }, [
    agents,
    isLoading,
    error,
    sectionTitle,
    setSectionTitle,
    loadAgentDetails,
    createAgent,
    updateAgent,
    deleteAgent,
  ]);

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}

export function useAgentsCtx(): AgentsContextValue {
  const ctx = useContext(AgentsContext);
  if (!ctx) throw new Error("useAgentsCtx must be used within <AgentsProvider>");
  return ctx;
}
