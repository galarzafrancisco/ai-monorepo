import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import { usePageTitle } from '../hooks/usePageTitle';
import './ConsentScreen.css';

interface AuthFlowDetails {
  id: string;
  server: {
    id: string;
    name: string;
    providedId: string;
  };
  client: {
    id: string;
    clientId: string;
    clientName: string;
    scopes?: string[];
  };
  resource: string;
  redirectUri: string;
  state: string;
}

export function ConsentScreen() {
  usePageTitle('Authorization Consent - AI Monorepo');

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const flowId = searchParams.get('flow');

  const [flowDetails, setFlowDetails] = useState<AuthFlowDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (!flowId) {
      setError('No authorization flow ID provided');
      setIsLoading(false);
      return;
    }

    loadFlowDetails();
  }, [flowId]);

  const loadFlowDetails = async () => {
    if (!flowId) return;

    setIsLoading(true);
    setError(null);

    try {
      const baseUrl = import.meta.env.PROD
        ? ''
        : `http://localhost:${import.meta.env.VITE_BACKEND_PORT || 3000}`;
      const response = await fetch(`${baseUrl}/api/v1/auth/flow/${flowId}`);

      if (!response.ok) {
        throw new Error(`Failed to load authorization details: ${response.statusText}`);
      }

      const data = await response.json();
      setFlowDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load authorization details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!flowDetails) return;

    setIsApproving(true);
    setError(null);

    try {
      const baseUrl = import.meta.env.PROD
        ? ''
        : `http://localhost:${import.meta.env.VITE_BACKEND_PORT || 3000}`;

      // POST consent decision to backend
      const response = await fetch(`${baseUrl}/api/v1/auth/authorize/mcp/${flowDetails.server.providedId}/0.0.0`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_id: flowId, approved: true }),
        redirect: 'manual', // Handle redirect manually to show any errors
      });

      // The backend will redirect to the client's redirect_uri
      // Since we're using redirect: 'manual', we need to follow it
      if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 301) {
        const redirectUrl = response.headers.get('Location') || response.url;
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          throw new Error('No redirect URL provided by server');
        }
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'Failed to process authorization');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve authorization');
      setIsApproving(false);
    }
  };

  const handleDeny = async () => {
    if (!flowDetails) return;

    setIsApproving(true);
    setError(null);

    try {
      const baseUrl = import.meta.env.PROD
        ? ''
        : `http://localhost:${import.meta.env.VITE_BACKEND_PORT || 3000}`;

      // POST denial to backend
      const response = await fetch(`${baseUrl}/api/v1/auth/authorize/mcp/${flowDetails.server.providedId}/0.0.0`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_id: flowId, approved: false }),
        redirect: 'manual',
      });

      // The backend will redirect to the client's redirect_uri with error
      if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 301) {
        const redirectUrl = response.headers.get('Location') || response.url;
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          throw new Error('No redirect URL provided by server');
        }
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'Failed to process denial');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny authorization');
      setIsApproving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="consent-page">
        <div className="consent-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading authorization details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !flowDetails) {
    return (
      <div className="consent-page">
        <div className="consent-container">
          <div className="error-state">
            <h1>Authorization Error</h1>
            <p className="error-message">{error || 'Invalid authorization request'}</p>
            <HomeLink />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="consent-page">
      <div className="consent-container">
        <div className="consent-header">
          <div className="oauth-icon">🔐</div>
          <h1>Authorization Request</h1>
          <p className="subtitle">
            <strong>{flowDetails.client.clientName}</strong> is requesting access to
          </p>
        </div>

        <div className="consent-details">
          <div className="detail-section">
            <h2>MCP Server</h2>
            <div className="server-info">
              <div className="server-name">{flowDetails.server.name}</div>
              <div className="server-id">{flowDetails.server.providedId}</div>
            </div>
          </div>

          <div className="detail-section">
            <h2>Resource</h2>
            <div className="resource-info">
              <code>{flowDetails.resource}</code>
            </div>
          </div>

          {flowDetails.client.scopes && flowDetails.client.scopes.length > 0 && (
            <div className="detail-section">
              <h2>Requested Permissions</h2>
              <ul className="scopes-list">
                {flowDetails.client.scopes.map((scope) => (
                  <li key={scope}>
                    <span className="scope-badge">{scope}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="detail-section">
            <h2>Client Information</h2>
            <div className="client-info">
              <div className="info-row">
                <span className="label">Client Name:</span>
                <span className="value">{flowDetails.client.clientName}</span>
              </div>
              <div className="info-row">
                <span className="label">Client ID:</span>
                <span className="value"><code>{flowDetails.client.clientId}</code></span>
              </div>
              <div className="info-row">
                <span className="label">Redirect URI:</span>
                <span className="value"><code>{flowDetails.redirectUri}</code></span>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="consent-actions">
          <button
            type="button"
            className="btn-deny"
            onClick={handleDeny}
            disabled={isApproving}
          >
            Deny
          </button>
          <button
            type="button"
            className="btn-approve"
            onClick={handleApprove}
            disabled={isApproving}
          >
            {isApproving ? 'Approving...' : 'Approve'}
          </button>
        </div>

        <div className="consent-footer">
          <p>
            By approving, you allow <strong>{flowDetails.client.clientName}</strong> to access the
            specified MCP server on your behalf.
          </p>
          <HomeLink />
        </div>
      </div>
    </div>
  );
}
