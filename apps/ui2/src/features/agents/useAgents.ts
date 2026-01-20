import { useEffect, useState } from 'react';
import { AgentsService } from './api';
import type { Agent } from './types';

export const useAgents = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [agents, setAgents] = useState<Agent[]>([]);

  // Boot
  useEffect(() => {
    loadAgents();
  }, []);

  // Sort agents by updatedAt (newest first)
  const sortAgents = (agents: Agent[]): Agent[] => {
    return [...agents].sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  };

  // Load agents
  const loadAgents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await AgentsService.agentsControllerListAgents();
      setAgents(sortAgents(response.items || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  };

  // Load agent details
  const loadAgentDetails = async (slug: string): Promise<Agent | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const agent = await AgentsService.agentsControllerGetAgentBySlug(slug);
      return agent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent details');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // UI feedback
    isLoading,
    error,

    // Data
    agents,
    loadAgents,
    loadAgentDetails,
  };
};
