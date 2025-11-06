import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import { useMcpRegistry } from './useMcpRegistry';
import { usePageTitle } from '../hooks/usePageTitle';
import './McpRegistry.css';

export function McpRegistryDashboard() {
  usePageTitle('MCP Registry');

  const { servers, isLoading, error, createServer } = useMcpRegistry();
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    providedId: '',
    name: '',
    description: '',
  });

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createServer(formData);
      setShowCreateForm(false);
      setFormData({ providedId: '', name: '', description: '' });
    } catch (err) {
      // Error is handled by the hook
      console.error('Failed to create server', err);
    }
  };

  return (
    <div className="mcp-registry">
      <div className="mcp-registry-header">
        <div>
          <h1>MCP Registry</h1>
          <p className="subtitle">Manage Model Context Protocol servers and their configurations</p>
        </div>
        <div className="header-actions">
          <HomeLink />
          <button onClick={() => setShowCreateForm(true)} className="btn-primary">
            + Add Server
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading servers...</div>
      ) : (
        <div className="servers-grid">
          {servers.length === 0 ? (
            <div className="empty-state">
              <p>No MCP servers registered yet.</p>
              <button onClick={() => setShowCreateForm(true)} className="btn-primary">
                Create your first server
              </button>
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className="server-card"
                onClick={() => navigate(`/mcp-registry/${server.id}`)}
              >
                <h3>{server.name}</h3>
                <p className="server-id">ID: {server.providedId}</p>
                <p className="server-description">{server.description}</p>
              </div>
            ))
          )}
        </div>
      )}

      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create MCP Server</h2>
            <form onSubmit={handleCreateServer}>
              <div className="form-group">
                <label htmlFor="providedId">Server ID</label>
                <input
                  type="text"
                  id="providedId"
                  value={formData.providedId}
                  onChange={(e) => setFormData({ ...formData, providedId: e.target.value })}
                  placeholder="e.g., my-mcp-server"
                  required
                />
                <small>Unique identifier for this server</small>
              </div>

              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., My MCP Server"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this server"
                  rows={3}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
