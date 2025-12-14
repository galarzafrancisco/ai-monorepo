import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthorizationServerService, OpenAPI, type ConsentDecisionDto } from './api';
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
      const data = await AuthorizationServerService.authorizationControllerGetFlow(flowId);
      setFlowDetails(data as AuthFlowDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load authorization details');
    } finally {
      setIsLoading(false);
    }
  };

  const submitConsent = async (approved: boolean) => {
    if (!flowDetails || !flowId) return;

    setIsApproving(true);
    setError(null);

    try {
      // OAuth 2.0 consent flow requires a server-side redirect to the client application.
      // The API endpoint (AuthorizationServerService.authorizationControllerAuthorizeConsent)
      // returns an HTTP 302 redirect to an external URL.
      //
      // We cannot use the generated client here because:
      // 1. Fetch API automatically follows redirects, preventing us from accessing the redirect URL
      // 2. The redirect URL is external (client application), which requires a full page navigation
      // 3. Browser security prevents JavaScript from navigating to external URLs via fetch
      //
      // Solution: Use form submission (traditional HTML form POST) which allows the browser
      // to naturally handle the redirect and navigate to the external client application.
      //
      // We maintain type safety by using ConsentDecisionDto structure for the form fields.
      const consentData: ConsentDecisionDto = {
        flow_id: flowId,
        approved: approved,
      };

      const bffBaseUrl = OpenAPI.BASE ?? '';
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${bffBaseUrl}/api/v1/auth/authorize/mcp/${flowDetails.server.providedId}/0.0.0`;

      // Create form fields matching ConsentDecisionDto
      Object.entries(consentData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit consent decision');
      setIsApproving(false);
    }
  };

  const handleApprove = () => {
    if (!flowDetails) return;
    submitConsent(true);
  };

  const handleDeny = () => {
    if (!flowDetails) return;
    submitConsent(false);
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
            Review the following authorization request carefully
          </p>
        </div>

        <div className="consent-details">
          <div className="detail-section">
            <h2>WHO is requesting access</h2>
            <div className="client-info">
              <div className="info-row">
                <span className="label">Client Name:</span>
                <span className="value">{flowDetails.client.clientName}</span>
              </div>
              <div className="info-row">
                <span className="label">Client ID:</span>
                <span className="value"><code>{flowDetails.client.clientId}</code></span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h2>WHAT access is requested</h2>
            {flowDetails.client.scopes && flowDetails.client.scopes.length > 0 ? (
              <>
                <ul className="scopes-list">
                  {flowDetails.client.scopes.map((scope) => (
                    <li key={scope}>
                      <span className="scope-badge">{scope}</span>
                    </li>
                  ))}
                </ul>
                <p style={{ marginTop: '12px', fontSize: '13px', color: '#7f8c8d', marginBottom: 0 }}>
                  These permissions determine what the client can do on your behalf.
                </p>
              </>
            ) : (
              <p style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: 0 }}>
                No specific permissions requested.
              </p>
            )}
          </div>

          <div className="detail-section">
            <h2>WHERE access is granted</h2>
            <div className="server-info">
              <div className="server-name">{flowDetails.server.name}</div>
              <div className="server-id">Server ID: {flowDetails.server.providedId}</div>
            </div>
            <div className="resource-info" style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '8px' }}>Resource:</div>
              <code>{flowDetails.resource}</code>
            </div>
          </div>

          <div className="detail-section">
            <h2>Redirect Information</h2>
            <div className="client-info">
              <div className="info-row">
                <span className="label">Redirect URI:</span>
                <span className="value"><code>{flowDetails.redirectUri}</code></span>
              </div>
            </div>
            <p style={{ marginTop: '12px', fontSize: '13px', color: '#7f8c8d', marginBottom: 0 }}>
              After authorization, you will be redirected to this URL.
            </p>
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
            By approving, you authorize <strong>{flowDetails.client.clientName}</strong> to access the
            specified resources with the requested permissions.
          </p>
          <HomeLink />
        </div>
      </div>
    </div>
  );
}
