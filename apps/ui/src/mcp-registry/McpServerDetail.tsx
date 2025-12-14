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


      <div className="detail-sections">
        {/* Authorization Server Metadata Section */}
        {authorizationServerMetadata && (
          <div className="detail-section">
            <div className="section-header">
              <h2>Authorization Server Metadata</h2>
              <button
                onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                className="btn-secondary"
              >
                {isMetadataExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
            {isMetadataExpanded && (
              <div>
                <p className="small-text">{authorizationServerMetadataUrl?.toString()}</p>
                <pre className="metadata-json">
                  {JSON.stringify(authorizationServerMetadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Scopes Section */}
        <div className="detail-section">
          <div className="section-header">
            <h2>Scopes</h2>
            <button onClick={() => setActiveForm('scope')} className="btn-secondary">
              + Add Scope
            </button>
          </div>
          <div className="items-list">
            {scopes.length === 0 ? (
              <p className="empty-text">No scopes defined</p>
            ) : (
              scopes.map((scope) => (
                <div key={scope.id} className="item-card">
                  <div className="item-content">
                    <h3>{scope.scopeId}</h3>
                    <p>{scope.description}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteScope(scope.scopeId)}
                    className="btn-delete"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Connections Section */}
        <div className="detail-section">
          <div className="section-header">
            <h2>OAuth Connections</h2>
            <button onClick={() => setActiveForm('connection')} className="btn-secondary">
              + Add Connection
            </button>
          </div>
          <div className="items-list">
            {connections.length === 0 ? (
              <p className="empty-text">No connections configured</p>
            ) : (
              connections.map((connection) => (
                <div key={connection.id} className="item-card">
                  <div className="item-content">
                    <h3>{connection.friendlyName}</h3>
                    <p>Client ID: {connection.clientId}</p>
                    <p className="small-text">Authorize: {connection.authorizeUrl}</p>
                    <p className="small-text">Token: {connection.tokenUrl}</p>
                  </div>
                  <div className="item-actions">
                    <button
                      onClick={() => handleEditConnection(connection.id)}
                      className="btn-secondary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteConnection(connection.id)}
                      className="btn-delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mappings Section - Only show if there are connections */}
        {connections.length > 0 && (
          <div className="detail-section">
            <div className="section-header">
              <h2>Scope Mappings</h2>
              <button
                onClick={() => setActiveForm('mapping')}
                className="btn-secondary"
                disabled={scopes.length === 0}
              >
                + Add Mapping
              </button>
            </div>
            <div className="items-list">
              {mappings.length === 0 ? (
                <p className="empty-text">No mappings configured</p>
              ) : (
                mappings.map((mapping) => {
                  const scope = scopes.find((s) => s.scopeId === mapping.scopeId);
                  const connection = connections.find((c) => c.id === mapping.connectionId);
                  return (
                    <div key={mapping.id} className="item-card">
                      <div className="item-content">
                        <h3>{scope?.scopeId || mapping.scopeId}</h3>
                        <p>→ {mapping.downstreamScope}</p>
                        <p className="small-text">via {connection?.friendlyName || 'Unknown'}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="btn-delete"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Scope Modal */}
      {activeForm === 'scope' && (
        <div className="modal-overlay" onClick={() => setActiveForm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create Scope</h2>
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
            <h2>Create OAuth Connection</h2>
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
            <h2>Edit OAuth Connection</h2>
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
