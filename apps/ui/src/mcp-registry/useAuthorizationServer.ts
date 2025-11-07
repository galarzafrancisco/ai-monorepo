import { useEffect, useMemo, useState } from 'react';
import { McpRegistryService } from './api';


export const useAuthorizationServer = (mcpServerId?: string, mcpServerVersion?: string) => {

  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [authorizationServerUrl, setAuthorizationServerUrl] = useState<URL | null>(null);
  const [authorizationServerMetadataUrl, setAuthorizationServerMetadataUrl] = useState<URL | null>(null);
  const [metadata, setMetadata] = useState<any>(null);

  async function loadMetadata(mcpServerId: string, mcpServerVersion: string) {

    // Make base url
    let baseUrl: string;
    if (import.meta.env.PROD) {
      baseUrl = '';
    } else {
      const PORT = import.meta.env.VITE_BACKEND_PORT || 3000;
      baseUrl = `http://localhost:${PORT}`;
    }


    // Make authorization server url
    const asUrl = new URL(`${baseUrl}/mcp/${mcpServerId}/${mcpServerVersion}`);
    setAuthorizationServerUrl(asUrl);


    // Make metadata url
    const asMetadataUrl = new URL(`${asUrl.origin}/.well-known/oauth-authorization-server${asUrl.pathname}`);
    setAuthorizationServerMetadataUrl(asMetadataUrl);

    fetchMetadata(asMetadataUrl);
  }

  async function fetchMetadata(authorizationServerMetadataUrl: URL) {
    // Load metadata
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(authorizationServerMetadataUrl.toString());
      const data = await response.json();
      setMetadata(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metadata');
      setMetadata({});
    } finally {
      setIsLoading(false);
    }
  }

  return {
    // UI feedback
    isLoading,
    error,

    // Data
    authorizationServerUrl,
    authorizationServerMetadataUrl,
    metadata,
    loadMetadata,
  };
};
