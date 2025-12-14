import { useState } from 'react';
import { getBFFBaseUrl } from '../config/api';


export const useAuthorizationServer = () => {

  // UI feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data store
  const [authorizationServerUrl, setAuthorizationServerUrl] = useState<URL | null>(null);
  const [authorizationServerMetadataUrl, setAuthorizationServerMetadataUrl] = useState<URL | null>(null);
  const [metadata, setMetadata] = useState<any>(null);

  async function loadMetadata(mcpServerId: string, mcpServerVersion: string) {

    // Make base url using centralized config
    const bffBaseUrl = getBFFBaseUrl();
    console.log('BFF Base URL:', bffBaseUrl);

    // Make authorization server url
    const asUrl = new URL(`${bffBaseUrl}/mcp/${mcpServerId}/${mcpServerVersion}`);
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
