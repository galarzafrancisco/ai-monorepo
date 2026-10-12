import { useEffect, useMemo, useState } from "react";
import { useConsentCtx } from "./ConsentProvider";
import { Link, useSearchParams } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { Card, DataRow, Stack, Text, ErrorText, Row, ListRow, Button } from "../../ui/primitives";
import './ConsentPage.css';

export function ConsentPage() {

  const isDesktop = useIsDesktop();

  console.log('Consent page mounting');
  const { setSectionTitle, loadConsentMetadata, submitConsent, consentMetadata, isLoading, isApproving, error } = useConsentCtx();

  const [searchParams] = useSearchParams();
  const flowId = searchParams.get('flow');

  if (!flowId) {
    return (
      <div>
        whoops! missing flow id 👀
      </div>
    )
  }

  // Load consent
  useEffect(() => {
    loadConsentMetadata(flowId);
  }, [flowId]);

  useEffect(() => {
    console.log('Consent page useEffect hook triggered');
    console.log('setting section title');
    setSectionTitle('🔐 Authorization request');
  }, []);

  const ready = useMemo(() => {
    return !isLoading && !error && consentMetadata;
  }, [isLoading, error, consentMetadata]);


  const handleApprove = () => {
    if (!consentMetadata) return;
    submitConsent(flowId, server.providedId, true);
  };

  const handleDeny = () => {
    if (!consentMetadata) return;
    submitConsent(flowId, server.providedId, false);
  };

  if (isLoading) {
    return (
      <div>
        <div className="spinner"></div>
        <p>Loading authorization details...</p>
      </div >
    )
  }
  if (error || !consentMetadata) {
    return (
      <div>
        <h2>Authorization Error</h2>
        <ErrorText >
          {error || 'Invalid authorization request'}
        </ErrorText>
      </div>
    )
  }

  const { client, scopes, redirectUri, server, resource, createdAt } = consentMetadata;

  // The client name is whatever the client says it is. What can be checked is
  // where its metadata document is published and where the user is sent next.
  const clientDocumentHost = client.registrationMethod === 'metadata_document' ? hostOf(client.clientId) : null;
  const redirectHost = hostOf(redirectUri);
  const redirectsToThisComputer = isLoopbackHost(redirectUri);

  return (
    <div className="consent-page">
      <div className="consent-container">
        {isDesktop ?
          <div className="consent-header">
            <div className="oauth-icon">🔐</div>
            <h1>Authorization Request</h1>
            <p className="subtitle">
              Review the following authorization request carefully
            </p>
          </div>
          : null}

        <div className="consent-details">
          <Card className="detail-section">
            <h2>WHO is requesting access</h2>
            <div className="client-info">
              <div className="info-row">
                <span className="label">Client Name:</span>
                <span className="value">{client.clientName}</span>
              </div>
              <div className="info-row">
                <span className="label">Client ID:</span>
                <span className="value"><code>{client.clientId}</code></span>
              </div>
              {clientDocumentHost ? (
                <div className="info-row">
                  <span className="label">Published by:</span>
                  <span className="value"><code>{clientDocumentHost}</code></span>
                </div>
              ) : null}
              <div className="info-row">
                <span className="label">Registered:</span>
                <span className="value"><code>{new Date(createdAt).toLocaleString()}</code></span>
              </div>
            </div>
          </Card>

          <Card className="detail-section">
            <h2>WHAT access is requested</h2>
            {scopes && scopes.length > 0 ? (
              <>
                <div className="scopes-list">
                  {scopes.map((scope) => (
                    <Chip key={scope}>{scope}</Chip>
                  ))}
                </div>
                <p style={{ marginTop: '12px', fontSize: '13px', color: '#7f8c8d', marginBottom: 0 }}>
                  These permissions determine what the client can do on your behalf.
                </p>
              </>
            ) : (
              <p style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: 0 }}>
                No specific permissions requested.
              </p>
            )}
          </Card>

          <Card className="detail-section">
            <h2>WHERE access is granted</h2>
            <div className="server-info">
              <div className="server-name">{server.name}</div>
              <div className="server-id">Server ID: {server.providedId}</div>
            </div>
            <div className="resource-info" style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '8px' }}>Resource:</div>
              <code>{resource}</code>
            </div>
          </Card>

          <Card className="detail-section">
            <h2>Redirect Information</h2>
            <div className="client-info">
              <div className="info-row">
                <span className="label">Sends you to:</span>
                <span className="value"><code>{redirectHost}</code></span>
              </div>
              <div className="info-row">
                <span className="label">Redirect URI:</span>
                <span className="value"><code>{redirectUri}</code></span>
              </div>
            </div>
            <p style={{ marginTop: '12px', fontSize: '13px', color: '#7f8c8d', marginBottom: 0 }}>
              After authorization, you will be redirected to this URL.
            </p>
            {redirectsToThisComputer ? (
              <p className="consent-warning">
                This address is on your own computer, so any app running on it could receive this authorization.
                Approve only if you started this from an app you trust.
              </p>
            ) : null}
          </Card>
        </div>

      </div>

      {error && <ErrorText>{error}</ErrorText>}



      <div className="consent-actions">
        <Button variant="danger" onClick={handleDeny} disabled={isApproving}>Deny</Button>
        <Button variant="primary" onClick={handleApprove} disabled={isApproving}>{isApproving ? 'Approving...' : 'Approve'}</Button>
      </div>

      <div className="consent-footer">
        <p>
          By approving, you authorize <strong>{consentMetadata.client.clientName}</strong> to access the
          specified resources with the requested permissions.
        </p>
        <Link
          to="/">
          Home
        </Link>
      </div>
    </div>
  )
}


function hostOf(uri: string): string {
  try {
    const url = new URL(uri);
    // App links such as cursor://callback have no host worth showing on its own
    return url.host || uri;
  } catch {
    return uri;
  }
}

function isLoopbackHost(uri: string): boolean {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname);
  } catch {
    return false;
  }
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="scope-badge">
      {children}
    </span>
  )
}