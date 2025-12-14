import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import { useMcpRegistry } from './useMcpRegistry';
import { usePageTitle } from '../hooks/usePageTitle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './McpRegistry.css';
import { useAuthorizationServer } from './useAuthorizationServer';

type FormType = 'scope' | 'connection' | 'mapping' | 'edit-connection' | null;

interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

export function McpServerDetail() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const {
    selectedServer,
    scopes,
    connections,
    mappings,
    isLoading,
    error,
    loadServerDetails,
    createScope,
    createConnection,
    updateConnection,
    createMapping,
    deleteScope,
    deleteConnection,
    deleteMapping,
  } = useMcpRegistry();

  const { metadata: authorizationServerMetadata, authorizationServerMetadataUrl, loadMetadata: loadAuthorizationServerMetadata } = useAuthorizationServer();

  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [scopeForm, setScopeForm] = useState({ scopeId: '', description: '' });
  const [connectionForm, setConnectionForm] = useState({
    clientId: '',
    clientSecret: '',
    authorizeUrl: '',
    tokenUrl: '',
    friendlyName: '',
    providedId: '',
  });
  const [mappingForm, setMappingForm] = useState({
    scopeId: '',
    mappings: [{ connectionId: '', downstreamScope: '' }],
  });

  usePageTitle(selectedServer ? `${selectedServer.name} - MCP Registry` : 'MCP Registry');

  useEffect(() => {
    if (serverId) {
      loadServerDetails(serverId);
    }
  }, [serverId]);

  useEffect(() => {
    if (!selectedServer) return;
    loadAuthorizationServerMetadata(selectedServer.providedId, "0.0.0");
  }, [selectedServer])

  const handleCreateScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId) return;
    try {
      await createScope(serverId, scopeForm.scopeId, scopeForm.description);
      setActiveForm(null);
      setScopeForm({ scopeId: '', description: '' });
    } catch (err) {
      console.error('Failed to create scope', err);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId) return;
    try {
      await createConnection(serverId, connectionForm);
      setActiveForm(null);
      setConnectionForm({
        clientId: '',
        clientSecret: '',
        authorizeUrl: '',
        tokenUrl: '',
        friendlyName: '',
        providedId: '',
      });
    } catch (err) {
      console.error('Failed to create connection', err);
    }
  };

  const handleEditConnection = (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId);
    if (connection) {
      setEditingConnectionId(connectionId);
      setConnectionForm({
        clientId: connection.clientId,
        clientSecret: '', // Don't populate password for security
        authorizeUrl: connection.authorizeUrl,
        tokenUrl: connection.tokenUrl,
        friendlyName: connection.friendlyName,
        providedId: connection.providedId || '',
      });
      setActiveForm('edit-connection');
    }
  };

  const handleUpdateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConnectionId) return;
    try {
      // Only send fields that have values (client secret is optional on update)
      const updateData: {
        clientId?: string;
        clientSecret?: string;
        authorizeUrl?: string;
        tokenUrl?: string;
        friendlyName?: string;
        providedId?: string;
      } = {};

      if (connectionForm.friendlyName) updateData.friendlyName = connectionForm.friendlyName;
      if (connectionForm.providedId) updateData.providedId = connectionForm.providedId;
      if (connectionForm.clientId) updateData.clientId = connectionForm.clientId;
      if (connectionForm.clientSecret) updateData.clientSecret = connectionForm.clientSecret;
      if (connectionForm.authorizeUrl) updateData.authorizeUrl = connectionForm.authorizeUrl;
      if (connectionForm.tokenUrl) updateData.tokenUrl = connectionForm.tokenUrl;

      await updateConnection(editingConnectionId, updateData);
      setActiveForm(null);
      setEditingConnectionId(null);
      setConnectionForm({
        clientId: '',
        clientSecret: '',
        authorizeUrl: '',
        tokenUrl: '',
        friendlyName: '',
        providedId: '',
      });
    } catch (err) {
      console.error('Failed to update connection', err);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId) return;
    try {
      // Create all mappings sequentially
      for (const mapping of mappingForm.mappings) {
        await createMapping(serverId, {
          scopeId: mappingForm.scopeId,
          connectionId: mapping.connectionId,
          downstreamScope: mapping.downstreamScope,
        });
      }
      setActiveForm(null);
      setMappingForm({ scopeId: '', mappings: [{ connectionId: '', downstreamScope: '' }] });
    } catch (err) {
      console.error('Failed to create mapping', err);
    }
  };

  const handleAddMappingRow = () => {
    const lastMapping = mappingForm.mappings[mappingForm.mappings.length - 1];
    setMappingForm({
      ...mappingForm,
      mappings: [
        ...mappingForm.mappings,
        { connectionId: lastMapping.connectionId, downstreamScope: '' },
      ],
    });
  };

  const handleRemoveMappingRow = (index: number) => {
    if (mappingForm.mappings.length === 1) return; // Keep at least one row
    setMappingForm({
      ...mappingForm,
      mappings: mappingForm.mappings.filter((_, i) => i !== index),
    });
  };

  const handleUpdateMappingRow = (
    index: number,
    field: 'connectionId' | 'downstreamScope',
    value: string
  ) => {
    const updatedMappings = [...mappingForm.mappings];
    updatedMappings[index] = { ...updatedMappings[index], [field]: value };
    setMappingForm({ ...mappingForm, mappings: updatedMappings });
  };

  const handleDeleteScope = async (scopeId: string) => {
    if (!serverId) return;
    setConfirmState({
      message: 'Are you sure you want to delete this scope?',
      onConfirm: async () => {
        try {
          await deleteScope(serverId, scopeId);
          setConfirmState(null);
        } catch (err) {
          console.error('Failed to delete scope', err);
          setConfirmState(null);
        }
      },
    });
  };

  const handleDeleteConnection = async (connectionId: string) => {
    setConfirmState({
      message: 'Are you sure you want to delete this connection?',
      onConfirm: async () => {
        try {
          await deleteConnection(connectionId);
          setConfirmState(null);
        } catch (err) {
          console.error('Failed to delete connection', err);
          setConfirmState(null);
        }
      },
    });
  };

  const handleDeleteMapping = async (mappingId: string) => {
    setConfirmState({
      message: 'Are you sure you want to delete this mapping?',
      onConfirm: async () => {
        try {
          await deleteMapping(mappingId);
          setConfirmState(null);
        } catch (err) {
          console.error('Failed to delete mapping', err);
          setConfirmState(null);
        }
      },
    });
  };

  // Group mappings by MCP Scope, then by Connection
  const groupedMappings = useMemo(() => {
    const groups: {
      [scopeId: string]: {
        scope: typeof scopes[0];
        connections: {
          [connectionId: string]: {
            connection: typeof connections[0];
            mappings: typeof mappings;
          };
        };
      };
    } = {};

    mappings.forEach((mapping) => {
      const scope = scopes.find((s) => s.scopeId === mapping.scopeId);
      const connection = connections.find((c) => c.id === mapping.connectionId);

      if (!scope || !connection) return;

      if (!groups[mapping.scopeId]) {
        groups[mapping.scopeId] = {
          scope,
          connections: {},
        };
      }

      if (!groups[mapping.scopeId].connections[mapping.connectionId]) {
        groups[mapping.scopeId].connections[mapping.connectionId] = {
          connection,
          mappings: [],
        };
      }

      groups[mapping.scopeId].connections[mapping.connectionId].mappings.push(mapping);
    });

    return groups;
  }, [mappings, scopes, connections]);

  if (isLoading && !selectedServer) {
    return <div className="loading">Loading server details...</div>;
  }

  if (!selectedServer) {
    return <div className="error-message">Server not found</div>;
  }

  return (
    <div className="mcp-registry">
      <div className="mcp-registry-header">
        <div>
          <button onClick={() => navigate('/mcp-registry')} className="btn-back">
            ← Back to Registry
          </button>
          <h1>{selectedServer.name}</h1>
          <p className="subtitle">{selectedServer.description}</p>
          <p className="server-id">ID: {selectedServer.providedId}</p>
        </div>
        <div className="header-actions">
          <HomeLink />
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Info Section */}
      <div className="info-section">
        <h2 className="section-title">Information</h2>
        <div className="section-divider"></div>

        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Name</span>
            <span className="info-value">{selectedServer.name}</span>
          </div>
          <div className="info-item">
            <span className="info-label">ID</span>
            <span className="info-value mono">{selectedServer.providedId}</span>
          </div>
          {connections.length > 0 && (
            <div className="info-item">
              <span className="info-label">Connections</span>
              <span className="info-value">{connections.map(c => c.friendlyName).join(', ')}</span>
            </div>
          )}
          {scopes.length > 0 && (
            <div className="info-item">
              <span className="info-label">Scopes</span>
              <span className="info-value">{scopes.map(s => s.scopeId).join(', ')}</span>
            </div>
          )}
          {selectedServer.url && (
            <div className="info-item inspector-command-item">
              <span className="info-label">Inspector Command</span>
              <div className="inspector-command">
                <code className="inspector-code">npx @modelcontextprotocol/inspector --transport http {selectedServer.url}</code>
                <button
                  className="btn-secondary btn-sm copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(`npx @modelcontextprotocol/inspector --transport http ${selectedServer.url}`);
                  }}
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Authorization Server Metadata */}
        {authorizationServerMetadata ? (
          <>
            <div className="section-divider"></div>
            <div className="metadata-section">
              <div className="metadata-header">
                <span className="metadata-status">✓ Authorization Server Metadata found</span>
                <button
                  onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                  className="btn-link"
                >
                  {isMetadataExpanded ? 'Hide' : 'Show'}
                </button>
              </div>
              {isMetadataExpanded && (
                <div className="metadata-content">
                  <p className="metadata-url">{authorizationServerMetadataUrl?.toString()}</p>
                  <pre className="metadata-json">
                    {JSON.stringify(authorizationServerMetadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Admin Section */}
      <div className="admin-section">
        <h2 className="section-title">Administration</h2>
        <div className="section-divider"></div>

        {/* Permissions (Scopes) */}
        <div className="admin-subsection">
          <div className="subsection-header">
            <h3>Permissions</h3>
          </div>
          <p className="subsection-description">
            Define the scopes (permissions) that will be available for MCP clients to request when connecting to this server.
          </p>
          {scopes.length === 0 ? (
            <div className="proper-table">
              <div className="table-add-row" onClick={() => setActiveForm('scope')}>
                <span className="add-row-text">Add permission...</span>
              </div>
            </div>
          ) : (
            <div className="proper-table">
              <div className="table-header">
                <div className="table-col-name">Scope Name</div>
                <div className="table-col-description">Description</div>
                <div className="table-col-actions"></div>
              </div>
              {scopes.map((scope) => (
                <div key={scope.id} className="table-body-row">
                  <div className="table-col-name">{scope.scopeId}</div>
                  <div className="table-col-description">{scope.description}</div>
                  <div className="table-col-actions">
                    <button
                      onClick={() => handleDeleteScope(scope.scopeId)}
                      className="btn-delete-small"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              <div className="table-add-row" onClick={() => setActiveForm('scope')}>
                <span className="add-row-text">Add permission...</span>
              </div>
            </div>
          )}
        </div>

        <div className="section-divider"></div>

        {/* Connections */}
        <div className="admin-subsection">
          <div className="subsection-header">
            <h3>Connections</h3>
          </div>
          <p className="subsection-description">
            Configure connections to downstream systems that support OAuth. The MCP server acts as a secure proxy, managing authentication and authorization on behalf of clients.
          </p>
          {connections.length === 0 ? (
            <div className="proper-table">
              <div className="table-add-row" onClick={() => setActiveForm('connection')}>
                <span className="add-row-text">Add connection...</span>
              </div>
            </div>
          ) : (
            <div className="proper-table">
              <div className="table-header">
                <div className="table-col-name">Connection Name</div>
                <div className="table-col-description">Description</div>
                <div className="table-col-actions"></div>
              </div>
              {connections.map((connection) => (
                <div key={connection.id} className="table-body-row">
                  <div className="table-col-name">{connection.friendlyName}</div>
                  <div className="table-col-description">
                    {connection.providedId && <span className="mono">{connection.providedId}</span>}
                  </div>
                  <div className="table-col-actions">
                    <button
                      onClick={() => handleEditConnection(connection.id)}
                      className="btn-secondary btn-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteConnection(connection.id)}
                      className="btn-delete-small"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              <div className="table-add-row" onClick={() => setActiveForm('connection')}>
                <span className="add-row-text">Add connection...</span>
              </div>
            </div>
          )}
        </div>

        {/* Scope Mappings - Integrated with Connections */}
        {connections.length > 0 && (
          <>
            <div className="section-divider"></div>
            <div className="admin-subsection">
              <div className="subsection-header">
                <h3>Scope Mappings</h3>
              </div>
              <p className="subsection-description">
                Map MCP server scopes to downstream connection scopes. When a client requests an MCP scope, the server will request the corresponding downstream scopes from the configured connections.
              </p>
              {mappings.length === 0 ? (
                <div className="mapping-group">
                  <div
                    className="table-add-row"
                    onClick={() => scopes.length > 0 && setActiveForm('mapping')}
                    style={{ opacity: scopes.length === 0 ? 0.5 : 1, cursor: scopes.length === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    <span className="add-row-text">
                      {scopes.length === 0 ? 'Add permissions first to create mappings...' : 'Add scope mapping...'}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.entries(groupedMappings).map(([scopeId, scopeGroup]) => (
                    <div key={scopeId} className="mapping-group">
                      <div className="mapping-group-header">
                        {scopeGroup.scope.scopeId} → {Object.keys(scopeGroup.connections).length} connection{Object.keys(scopeGroup.connections).length !== 1 ? 's' : ''}
                      </div>
                      <div className="mapping-items">
                        {Object.entries(scopeGroup.connections).map(([connectionId, connectionGroup]) =>
                          connectionGroup.mappings.map((mapping) => (
                            <div key={mapping.id} className="mapping-item">
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a202c', marginBottom: '4px' }}>
                                  {connectionGroup.connection.friendlyName}
                                </div>
                                <div className="mapping-item-scope">{mapping.downstreamScope}</div>
                              </div>
                              <button
                                onClick={() => handleDeleteMapping(mapping.id)}
                                className="btn-delete-small"
                                title="Delete mapping"
                              >
                                Delete
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="mapping-group">
                    <div
                      className="table-add-row"
                      onClick={() => scopes.length > 0 && setActiveForm('mapping')}
                      style={{ opacity: scopes.length === 0 ? 0.5 : 1, cursor: scopes.length === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      <span className="add-row-text">
                        {scopes.length === 0 ? 'Add permissions first to create mappings...' : 'Add scope mapping...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create Scope Modal */}
      {activeForm === 'scope' && (
        <div className="modal-overlay" onClick={() => setActiveForm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create Permission</h2>
            <form onSubmit={handleCreateScope}>
              <div className="form-group">
                <label htmlFor="scopeId">Scope ID</label>
                <input
                  type="text"
                  id="scopeId"
                  value={scopeForm.scopeId}
                  onChange={(e) => setScopeForm({ ...scopeForm, scopeId: e.target.value })}
                  placeholder="e.g., tool:read"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="scopeDescription">Description</label>
                <textarea
                  id="scopeDescription"
                  value={scopeForm.description}
                  onChange={(e) => setScopeForm({ ...scopeForm, description: e.target.value })}
                  placeholder="What does this scope provide?"
                  rows={3}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setActiveForm(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Scope
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Connection Modal */}
      {activeForm === 'connection' && (
        <div className="modal-overlay" onClick={() => setActiveForm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create Connection</h2>
            <form onSubmit={handleCreateConnection} autoComplete="off">
              <div className="form-group">
                <label htmlFor="friendlyName">Friendly Name</label>
                <input
                  type="text"
                  id="friendlyName"
                  value={connectionForm.friendlyName}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, friendlyName: e.target.value })
                  }
                  placeholder="e.g., GitHub OAuth"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="providedId">
                  Provided ID <span style={{ color: '#888', fontWeight: 'normal' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  id="providedId"
                  value={connectionForm.providedId}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, providedId: e.target.value })
                  }
                  placeholder="e.g., google-oauth, github-integration"
                  pattern="[a-zA-Z0-9_-]+"
                  title="Only alphanumeric characters, dashes, and underscores are allowed"
                  autoComplete="off"
                />
                <small style={{ color: '#888', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Unique identifier for token exchange (alphanumeric, dash, underscore only)
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="clientId">Client ID</label>
                <input
                  type="text"
                  id="clientId"
                  value={connectionForm.clientId}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, clientId: e.target.value })
                  }
                  autoComplete="off"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="clientSecret">Client Secret</label>
                <input
                  type="password"
                  id="clientSecret"
                  value={connectionForm.clientSecret}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, clientSecret: e.target.value })
                  }
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="authorizeUrl">Authorize URL</label>
                <input
                  type="url"
                  id="authorizeUrl"
                  value={connectionForm.authorizeUrl}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, authorizeUrl: e.target.value })
                  }
                  placeholder="https://..."
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="tokenUrl">Token URL</label>
                <input
                  type="url"
                  id="tokenUrl"
                  value={connectionForm.tokenUrl}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, tokenUrl: e.target.value })
                  }
                  placeholder="https://..."
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setActiveForm(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Connection Modal */}
      {activeForm === 'edit-connection' && (
        <div className="modal-overlay" onClick={() => setActiveForm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Connection</h2>
            <form onSubmit={handleUpdateConnection} autoComplete="off">
              <div className="form-group">
                <label htmlFor="editFriendlyName">Friendly Name</label>
                <input
                  type="text"
                  id="editFriendlyName"
                  value={connectionForm.friendlyName}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, friendlyName: e.target.value })
                  }
                  placeholder="e.g., GitHub OAuth"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="editProvidedId">
                  Provided ID <span style={{ color: '#888', fontWeight: 'normal' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  id="editProvidedId"
                  value={connectionForm.providedId}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, providedId: e.target.value })
                  }
                  placeholder="e.g., google-oauth, github-integration"
                  pattern="[a-zA-Z0-9_-]+"
                  title="Only alphanumeric characters, dashes, and underscores are allowed"
                  autoComplete="off"
                />
                <small style={{ color: '#888', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  Unique identifier for token exchange (alphanumeric, dash, underscore only)
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="editClientId">Client ID</label>
                <input
                  type="text"
                  id="editClientId"
                  value={connectionForm.clientId}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, clientId: e.target.value })
                  }
                  autoComplete="off"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="editClientSecret">Client Secret (leave blank to keep current)</label>
                <input
                  type="password"
                  id="editClientSecret"
                  value={connectionForm.clientSecret}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, clientSecret: e.target.value })
                  }
                  placeholder="Enter new secret or leave blank"
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label htmlFor="editAuthorizeUrl">Authorize URL</label>
                <input
                  type="url"
                  id="editAuthorizeUrl"
                  value={connectionForm.authorizeUrl}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, authorizeUrl: e.target.value })
                  }
                  placeholder="https://..."
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="editTokenUrl">Token URL</label>
                <input
                  type="url"
                  id="editTokenUrl"
                  value={connectionForm.tokenUrl}
                  onChange={(e) =>
                    setConnectionForm({ ...connectionForm, tokenUrl: e.target.value })
                  }
                  placeholder="https://..."
                  required
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setActiveForm(null);
                    setEditingConnectionId(null);
                    setConnectionForm({
                      clientId: '',
                      clientSecret: '',
                      authorizeUrl: '',
                      tokenUrl: '',
                      friendlyName: '',
                      providedId: '',
                    });
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Mapping Modal */}
      {activeForm === 'mapping' && (
        <div className="modal-overlay" onClick={() => setActiveForm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create Scope Mapping</h2>
            <form onSubmit={handleCreateMapping}>
              <div className="form-group">
                <label htmlFor="mappingScopeId">MCP Scope</label>
                <select
                  id="mappingScopeId"
                  value={mappingForm.scopeId}
                  onChange={(e) => setMappingForm({ ...mappingForm, scopeId: e.target.value })}
                  required
                >
                  <option value="">Select a scope</option>
                  {scopes.map((scope) => (
                    <option key={scope.id} value={scope.scopeId}>
                      {scope.scopeId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Connection & Downstream Scope Mappings</label>
                {mappingForm.mappings.map((mapping, index) => (
                  <div key={index} className="mapping-row">
                    <select
                      value={mapping.connectionId}
                      onChange={(e) =>
                        handleUpdateMappingRow(index, 'connectionId', e.target.value)
                      }
                      required
                      className="mapping-connection-select"
                    >
                      <option value="">Select a connection</option>
                      {connections.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.friendlyName}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={mapping.downstreamScope}
                      onChange={(e) =>
                        handleUpdateMappingRow(index, 'downstreamScope', e.target.value)
                      }
                      placeholder="e.g., repo:read"
                      required
                      className="mapping-scope-input"
                    />
                    {mappingForm.mappings.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMappingRow(index)}
                        className="btn-remove"
                        aria-label="Remove mapping"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddMappingRow}
                  className="btn-add-mapping"
                >
                  + Add Entry
                </button>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setActiveForm(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
