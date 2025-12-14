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
    setIsLoading(true);
    setError(null);

    try {
      // Fetch the authorization server issuer URL from the backend
      const bffBaseUrl = getBFFBaseUrl();
      const issuerResponse = await fetch(`${bffBaseUrl}/.well-known/oauth-authorization-server/mcp/issuer`);

      if (!issuerResponse.ok) {
        throw new Error('Failed to fetch authorization server issuer URL');
      }

      const { issuer } = await issuerResponse.json();
      console.log('Authorization Server Issuer:', issuer);

      // Make authorization server url using the issuer from backend
      const asUrl = new URL(`${issuer}/mcp/${mcpServerId}/${mcpServerVersion}`);
      setAuthorizationServerUrl(asUrl);

      // Make metadata url
      const asMetadataUrl = new URL(`${asUrl.origin}/.well-known/oauth-authorization-server${asUrl.pathname}`);
      setAuthorizationServerMetadataUrl(asMetadataUrl);

      await fetchMetadata(asMetadataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load authorization server configuration');
      setIsLoading(false);
    }
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
