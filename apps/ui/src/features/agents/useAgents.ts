import { useEffect, useState } from 'react';
import { AgentsService } from './api';
import type { Agent } from './types';
import type { TaskStatus } from '../../shared/const/taskStatus';
import type { AgentResponseDto, CreateAgentDto, PatchAgentDto } from "@taico/client/v2";

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
      const response = await AgentsService.AgentsController_listAgents({});
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
      const agent = await AgentsService.AgentsController_getAgentBySlug({ slug });
      return agent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent details');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Create agent
  const createAgent = async (params: CreateAgentDto): Promise<Agent | null> => {
    setIsLoading(true);
    setError(null);
    try {
      // Create agent with mandatory fields and defaults for the rest
      const newAgent = await AgentsService.AgentsController_createAgent({
        body: {
          name: params.name,
          slug: params.slug,
          systemPrompt: params.systemPrompt,
          allowedTools: params.allowedTools ?? [],
          type: params.type,
          description: params.description,
          introduction: params.introduction,
          avatarUrl: params.avatarUrl,
          providerId: params.providerId,
          modelId: params.modelId,
          statusTriggers: params.statusTriggers,
          tagTriggers: params.tagTriggers,
          isActive: params.isActive,
          concurrencyLimit: params.concurrencyLimit,
        }
      });

      // Add to local state
      setAgents((prevAgents) => {
        return sortAgents([...prevAgents, newAgent]);
      });

      return newAgent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Update agent
  const updateAgent = async (
    actorId: string,
    updates: PatchAgentDto
  ): Promise<Agent | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedAgent = await AgentsService.AgentsController_patchAgent({ actorId, body: updates });

      // Update local state
      setAgents((prevAgents) => {
        const newAgents = prevAgents.map((agent) =>
          agent.actorId === actorId ? updatedAgent : agent
        );
        return sortAgents(newAgents);
      });

      return updatedAgent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete agent
  const deleteAgent = async (actorId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await AgentsService.AgentsController_deleteAgent({ actorId });

      // Remove from local state
      setAgents((prevAgents) => {
        return prevAgents.filter((agent) => agent.actorId !== actorId);
      });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      return false;
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
    createAgent,
    updateAgent,
    deleteAgent,
  };
};
