import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMcpRegistry } from './useMcpRegistry';
import { usePageTitle } from '../hooks/usePageTitle';
import './McpRegistry.css';

type FormType = 'scope' | 'connection' | 'mapping' | null;

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
    createMapping,
    deleteScope,
    deleteConnection,
    deleteMapping,
  } = useMcpRegistry();

  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [scopeForm, setScopeForm] = useState({ scopeId: '', description: '' });
  const [connectionForm, setConnectionForm] = useState({
    clientId: '',
    clientSecret: '',
    authorizeUrl: '',
    tokenUrl: '',
    friendlyName: '',
  });
  const [mappingForm, setMappingForm] = useState({
    scopeId: '',
    connectionId: '',
    downstreamScope: '',
  });

  usePageTitle(selectedServer ? `${selectedServer.name} - MCP Registry` : 'MCP Registry');

  useEffect(() => {
    if (serverId) {
      loadServerDetails(serverId);
    }
  }, [serverId]);

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
      });
    } catch (err) {
      console.error('Failed to create connection', err);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId) return;
    try {
      await createMapping(serverId, mappingForm);
      setActiveForm(null);
      setMappingForm({ scopeId: '', connectionId: '', downstreamScope: '' });
    } catch (err) {
      console.error('Failed to create mapping', err);
    }
  };

  const handleDeleteScope = async (scopeId: string) => {
    if (!serverId || !confirm('Are you sure you want to delete this scope?')) return;
    try {
      await deleteScope(serverId, scopeId);
    } catch (err) {
      console.error('Failed to delete scope', err);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    try {
      await deleteConnection(connectionId);
    } catch (err) {
      console.error('Failed to delete connection', err);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;
    try {
      await deleteMapping(mappingId);
    } catch (err) {
      console.error('Failed to delete mapping', err);
    }
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
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="detail-sections">
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
                  <button
                    onClick={() => handleDeleteConnection(connection.id)}
                    className="btn-delete"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mappings Section */}
        <div className="detail-section">
          <div className="section-header">
            <h2>Scope Mappings</h2>
            <button
              onClick={() => setActiveForm('mapping')}
              className="btn-secondary"
              disabled={scopes.length === 0 || connections.length === 0}
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
            <form onSubmit={handleCreateConnection}>
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
                  required
                />
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
                <label htmlFor="mappingConnectionId">Connection</label>
                <select
                  id="mappingConnectionId"
                  value={mappingForm.connectionId}
                  onChange={(e) =>
                    setMappingForm({ ...mappingForm, connectionId: e.target.value })
                  }
                  required
                >
                  <option value="">Select a connection</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.friendlyName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="downstreamScope">Downstream Scope</label>
                <input
                  type="text"
                  id="downstreamScope"
                  value={mappingForm.downstreamScope}
                  onChange={(e) =>
                    setMappingForm({ ...mappingForm, downstreamScope: e.target.value })
                  }
                  placeholder="e.g., repo:read"
                  required
                />
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
    </div>
  );
}
