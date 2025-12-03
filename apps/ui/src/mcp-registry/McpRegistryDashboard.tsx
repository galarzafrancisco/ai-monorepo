import { useState } from "react";
import { useNavigate } from "react-router";
import { HomeLink } from "../components/HomeLink";
import { useMcpRegistry } from "./useMcpRegistry";
import { usePageTitle } from "../hooks/usePageTitle";
import "./McpRegistry.css";

export function McpRegistryDashboard() {
  usePageTitle("MCP Registry");

  const { servers, isLoading, error, createServer } = useMcpRegistry();
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    providedId: "",
    name: "",
    description: "",
  });

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const createdServer = await createServer(formData);
      setShowCreateForm(false);
      setFormData({ providedId: "", name: "", description: "" });
      if (createdServer) {
        navigate(`/mcp-registry/${createdServer.id}`);
      }
    } catch (err) {
      console.error("Failed to create server", err);
    }
  };

  return (
    <div className="mcp-page">
      <div className="mcp-container">
        <header className="mcp-header">
          <div className="header-content">
            <div className="header-title-section">
              <h1 className="mcp-title">MCP Registry</h1>
              <p className="mcp-subtitle">
                Model Context Protocol servers and configurations
              </p>
            </div>
            <div className="header-actions">
              <HomeLink />
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn btn-primary btn-sm"
              >
                + Add Server
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="error-state">
            <p>{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="loading-state">
            <span className="spinner"></span>
            <p>Loading servers…</p>
          </div>
        ) : servers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◆</div>
            <h2 className="empty-state-title">No servers yet</h2>
            <p className="empty-state-description">
              Create your first MCP server to get started
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn btn-primary"
            >
              + Create first server
            </button>
          </div>
        ) : (
          <div className="servers-grid">
            {servers.map((server, index) => (
              <div
                key={server.id}
                className="server-card"
                onClick={() => navigate(`/mcp-registry/${server.id}`)}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="server-card-header">
                  <h3 className="server-card-title">{server.name}</h3>
                  <div className="server-card-id">{server.providedId}</div>
                </div>
                <p className="server-card-description">{server.description}</p>
                <div className="server-card-footer">
                  <span className="server-card-arrow">→</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreateForm && (
          <div
            className="modal-backdrop"
            onClick={() => setShowCreateForm(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Create MCP Server</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-ghost btn-sm"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateServer}>
                <div className="modal-body">
                  <div className="form-field">
                    <label htmlFor="providedId" className="form-label">
                      Server ID
                    </label>
                    <input
                      type="text"
                      id="providedId"
                      className="input"
                      value={formData.providedId}
                      onChange={(e) =>
                        setFormData({ ...formData, providedId: e.target.value })
                      }
                      placeholder="e.g., my-mcp-server"
                      required
                    />
                    <small className="form-hint">
                      Unique identifier for this server
                    </small>
                  </div>

                  <div className="form-field">
                    <label htmlFor="name" className="form-label">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      className="input"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., My MCP Server"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="description" className="form-label">
                      Description
                    </label>
                    <textarea
                      id="description"
                      className="textarea"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Brief description of this server"
                      rows={3}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Server
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
