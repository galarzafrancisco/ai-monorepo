import { useEffect, useState } from 'react';
import { McpRegistryService } from './api';

// Types will be generated from backend response DTOs
type McpServer = {
  id: string;
  providedId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type McpScope = {
  id: string;
  scopeId: string;
  serverId: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type McpConnection = {
  id: string;
  serverId: string;
  clientId: string;
  authorizeUrl: string;
  tokenUrl: string;
  friendlyName: string;
  createdAt: string;
  updatedAt: string;
};

type McpScopeMapping = {
  id: string;
  scopeId: string;
  serverId: string;
  connectionId: string;
  downstreamScope: string;
  createdAt: string;
  updatedAt: string;
};

export const useMcpRegistry = () => {
  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [servers, setServers] = useState<McpServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const [scopes, setScopes] = useState<McpScope[]>([]);
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [mappings, setMappings] = useState<McpScopeMapping[]>([]);

  // Boot
  useEffect(() => {
    loadServers();
  }, []);

  // Load servers
  const loadServers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await McpRegistryService.mcpRegistryControllerListServers();
      setServers(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load servers');
    } finally {
      setIsLoading(false);
    }
  };

  // Load server details (scopes, connections, mappings)
  const loadServerDetails = async (serverId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [serverData, scopesData, connectionsData] = await Promise.all([
        McpRegistryService.mcpRegistryControllerGetServer(serverId),
        McpRegistryService.mcpRegistryControllerListScopes(serverId),
        McpRegistryService.mcpRegistryControllerListConnections(serverId),
      ]);

      setSelectedServer(serverData);
      setScopes(scopesData || []);
      setConnections(connectionsData || []);

      // Load mappings for each scope
      if (scopesData && scopesData.length > 0) {
        const allMappings: McpScopeMapping[] = [];
        for (const scope of scopesData) {
          try {
            const scopeMappings = await McpRegistryService.mcpRegistryControllerListMappings(
              serverId,
              scope.scopeId
            );
            if (scopeMappings) {
              allMappings.push(...scopeMappings);
            }
          } catch (err) {
            console.error(`Failed to load mappings for scope ${scope.scopeId}`, err);
          }
        }
        setMappings(allMappings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server details');
    } finally {
      setIsLoading(false);
    }
  };

  // Create server
  const createServer = async (data: { providedId: string; name: string; description: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      await McpRegistryService.mcpRegistryControllerCreateServer(data);
      await loadServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Create scope
  const createScope = async (serverId: string, scopeId: string, description: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await McpRegistryService.mcpRegistryControllerCreateScopes(serverId, [{ scopeId, description }]);
      if (selectedServer?.id === serverId) {
        await loadServerDetails(serverId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scope');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Create connection
  const createConnection = async (
    serverId: string,
    data: {
      clientId: string;
      clientSecret: string;
      authorizeUrl: string;
      tokenUrl: string;
      friendlyName: string;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await McpRegistryService.mcpRegistryControllerCreateConnection(serverId, data);
      if (selectedServer?.id === serverId) {
        await loadServerDetails(serverId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create connection');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update connection
  const updateConnection = async (
    connectionId: string,
    data: {
      clientId?: string;
      clientSecret?: string;
      authorizeUrl?: string;
      tokenUrl?: string;
      friendlyName?: string;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await McpRegistryService.mcpRegistryControllerUpdateConnection(connectionId, data);
      if (selectedServer) {
        await loadServerDetails(selectedServer.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update connection');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Create mapping
  const createMapping = async (
    serverId: string,
    data: {
      scopeId: string;
      connectionId: string;
      downstreamScope: string;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await McpRegistryService.mcpRegistryControllerCreateMapping(serverId, data);
      if (selectedServer?.id === serverId) {
        await loadServerDetails(serverId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mapping');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete scope
  const deleteScope = async (serverId: string, scopeId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await McpRegistryService.mcpRegistryControllerDeleteScope(serverId, scopeId);
      if (selectedServer?.id === serverId) {
        await loadServerDetails(serverId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scope');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete connection
  const deleteConnection = async (connectionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await McpRegistryService.mcpRegistryControllerDeleteConnection(connectionId);
      if (selectedServer) {
        await loadServerDetails(selectedServer.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete mapping
  const deleteMapping = async (mappingId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await McpRegistryService.mcpRegistryControllerDeleteMapping(mappingId);
      if (selectedServer) {
        await loadServerDetails(selectedServer.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mapping');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // UI feedback
    isLoading,
    error,

    // Data
    servers,
    selectedServer,
    scopes,
    connections,
    mappings,

    // Actions
    loadServers,
    loadServerDetails,
    createServer,
    createScope,
    createConnection,
    createMapping,
    deleteScope,
    deleteConnection,
    deleteMapping,
  };
};
