import { useEffect, useState } from 'react';
import { AgentService } from './api';
import type { AgentResponseDto, CreateAgentDto, UpdateAgentDto } from 'shared';

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
  const loadAgentDetails = async (agentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const agentData = await AgentService.agentsControllerGetAgent(agentId);
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

  // Update agent
  const updateAgent = async (agentId: string, data: UpdateAgentDto): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedAgent = await AgentService.agentsControllerUpdateAgent(agentId, data);
      setSelectedAgent(updatedAgent);
      await loadAgents(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete agent
  const deleteAgent = async (agentId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await AgentService.agentsControllerDeleteAgent(agentId);
      await loadAgents(); // Refresh the list
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      throw err;
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
    updateAgent,
    deleteAgent,
  };
};
