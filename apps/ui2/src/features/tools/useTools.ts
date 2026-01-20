import { useEffect, useState, useCallback } from 'react';
import { ToolsService } from './api';
import type { Tool, ToolScope, ToolClient } from './types';

export const useTools = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [tools, setTools] = useState<Tool[]>([]);

  // Boot
  useEffect(() => {
    loadTools();
  }, []);

  // Sort tools by updatedAt (newest first)
  const sortTools = (tools: Tool[]): Tool[] => {
    return [...tools].sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  };

  // Load tools
  const loadTools = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ToolsService.mcpRegistryControllerListServers();
      setTools(sortTools(response.items || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setIsLoading(false);
    }
  };

  // Load tool details
  const loadToolDetails = useCallback(async (serverId: string): Promise<Tool | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const tool = await ToolsService.mcpRegistryControllerGetServer(serverId);
      return tool;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tool details');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load scopes for a tool
  const loadToolScopes = useCallback(async (serverId: string): Promise<ToolScope[]> => {
    try {
      const scopes = await ToolsService.mcpRegistryControllerListScopes(serverId);
      return scopes;
    } catch (err) {
      console.error('Failed to load scopes:', err);
      return [];
    }
  }, []);

  // Load clients (connections) for a tool
  const loadToolClients = useCallback(async (serverId: string): Promise<ToolClient[]> => {
    console.log(`loading clients for server ${serverId}`)
    try {
      const clients = await ToolsService.mcpRegistryControllerListConnections(serverId);
      console.log(`clients: ${clients}`)
      return clients;
    } catch (err) {
      console.error('Failed to load clients:', err);
      return [];
    }
  }, []);

  // Load single client details
  const loadClientDetails = useCallback(async (connectionId: string): Promise<ToolClient | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const client = await ToolsService.mcpRegistryControllerGetConnection(connectionId);
      return client;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client details');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // UI feedback
    isLoading,
    error,

    // Data
    tools,
    loadTools,
    loadToolDetails,
    loadToolScopes,
    loadToolClients,
    loadClientDetails,
  };
};
