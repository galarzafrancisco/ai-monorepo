import { useEffect, useState, useCallback } from 'react';
import { ToolsService, AuthorizationJourneysService } from './api';
import type { Tool, ToolScope, ToolClient, ToolAuthorization } from './types';
import { CreateServerDto } from '@taico/client';

const DEFAULT_HTTP_URL = 'http://localhost:3000/mcp';
const DEFAULT_STDIO_CMD = 'npx';
const DEFAULT_STDIO_ARGS = ['-y', '@modelcontextprotocol/server-memory'] as const;

const toProvidedId = (name: string): string => {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'new-tool';
};

const ensureUniqueProvidedId = (base: string, tools: Tool[]): string => {
  const existing = new Set(tools.map((tool) => tool.providedId));
  if (!existing.has(base)) {
    return base;
  }

  let candidateIndex = 2;
  let candidate = `${base}-${candidateIndex}`;
  while (existing.has(candidate)) {
    candidateIndex += 1;
    candidate = `${base}-${candidateIndex}`;
  }

  return candidate;
};

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

  // Load authorizations (auth journeys) for a tool
  const loadToolAuthorizations = useCallback(async (serverId: string): Promise<ToolAuthorization[]> => {
    console.log(`loading authorizations for server ${serverId}`)
    try {
      const authorizations = await AuthorizationJourneysService.authJourneysControllerGetAuthJourneys(serverId);
      console.log(`authorizations:`, authorizations)
      return authorizations;
    } catch (err) {
      console.error('Failed to load authorizations:', err);
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

  // Create tool
  const createTool = async (params: { name: string; type: 'http' | 'stdio' }): Promise<Tool | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const baseProvidedId = toProvidedId(params.name);
      const providedId = ensureUniqueProvidedId(baseProvidedId, tools);

      const request: CreateServerDto = {
        providedId,
        name: params.name,
        description: `New ${params.type.toUpperCase()} MCP server`,
        type:
          params.type === 'http'
            ? CreateServerDto.type.HTTP
            : CreateServerDto.type.STDIO,
        ...(params.type === 'http'
          ? { url: DEFAULT_HTTP_URL }
          : { cmd: DEFAULT_STDIO_CMD, args: [...DEFAULT_STDIO_ARGS] }),
      };

      const newTool = await ToolsService.mcpRegistryControllerCreateServer(request);

      setTools((previousTools) => {
        return sortTools([...previousTools, newTool]);
      });

      return newTool;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tool');
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
    tools,
    loadTools,
    loadToolDetails,
    loadToolScopes,
    loadToolClients,
    loadToolAuthorizations,
    loadClientDetails,
    createTool,
  };
};
