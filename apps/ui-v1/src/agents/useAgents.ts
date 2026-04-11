import { useEffect, useState } from 'react';
import { AgentService } from './api';
import type { AgentResponseDto, CreateAgentDto } from "@taico/client";

export const useAgents = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [agents, setAgents] = useState<AgentResponseDto[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentResponseDto | null>(null);

  // Boot
  useEffect(() => {
    loadAgents();
  }, []);

  // Load agents
  const loadAgents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await AgentService.agentsControllerListAgents();
      setAgents(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  };

  // Load agent details
  const loadAgentDetails = async (agentSlug: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const agentData = await AgentService.agentsControllerGetAgentBySlug(agentSlug);
      setSelectedAgent(agentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent details');
    } finally {
      setIsLoading(false);
    }
  };

  // Create agent
  const createAgent = async (data: CreateAgentDto): Promise<AgentResponseDto | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const createdAgent = await AgentService.agentsControllerCreateAgent(data);
      await loadAgents(); // Refresh the list
      return createdAgent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
      return null;
    } finally {
      setIsLoading(false);
    }
  };


  return {
    agents,
    selectedAgent,
    isLoading,
    error,
    loadAgents,
    loadAgentDetails,
    createAgent,
  };
};
