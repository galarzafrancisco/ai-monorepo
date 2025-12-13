import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgents } from './useAgents';

export function AgentsAdminList() {
  const { agents, isLoading, error, createAgent } = useAgents();
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    description: '',
    systemPrompt: '',
    allowedTools: '',
    isActive: true,
  });

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const createdAgent = await createAgent({
        slug: formData.slug,
        name: formData.name,
        description: formData.description,
        systemPrompt: formData.systemPrompt,
        allowedTools: formData.allowedTools.split(',').map(tool => tool.trim()).filter(Boolean),
        isActive: formData.isActive,
      });
      setShowCreateForm(false);
      setFormData({ slug: '', name: '', description: '', systemPrompt: '', allowedTools: '', isActive: true });
      // Navigate to the newly created agent's admin page
      if (createdAgent) {
        navigate(`/agents/${createdAgent.id}/admin`);
      }
    } catch (err) {
      console.error('Failed to create agent', err);
    }
  };

  return (
    <div className="agents-admin-list">
      <div className="agents-admin-header">
        <div>
          <h1>Agents Admin</h1>
          <p className="subtitle">Manage agents and their configurations</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateForm(true)} className="btn-primary">
            + Create Agent
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading agents...</div>
      ) : (
        <div className="agents-admin-grid">
          {agents.length === 0 ? (
            <div className="empty-state">
              <p>No agents created yet.</p>
              <button onClick={() => setShowCreateForm(true)} className="btn-primary">
                Create your first agent
              </button>
            </div>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="agent-admin-card"
                onClick={() => navigate(`/agents/${agent.id}/admin`)}
              >
                <div className="agent-admin-card-header">
                  <h3>{agent.name}</h3>
                  <span className={`agent-status ${agent.isActive ? 'active' : 'inactive'}`}>
                    {agent.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="agent-slug">@{agent.slug}</p>
                <p className="agent-description">{typeof agent.description === 'string' ? agent.description : 'No description'}</p>
                <p className="agent-tools">Tools: {agent.allowedTools.length > 0 ? agent.allowedTools.join(', ') : 'None'}</p>
              </div>
            ))
          )}
        </div>
      )}

      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create Agent</h2>
            <form onSubmit={handleCreateAgent}>
              <div className="form-group">
                <label htmlFor="slug">Slug</label>
                <input
                  type="text"
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., code-assistant"
                  required
                />
                <small>Unique identifier (lowercase, hyphens allowed)</small>
              </div>

              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Code Assistant"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this agent"
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label htmlFor="systemPrompt">System Prompt</label>
                <textarea
                  id="systemPrompt"
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder="Core instructions/persona for this agent"
                  rows={5}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="allowedTools">Allowed Tools</label>
                <input
                  type="text"
                  id="allowedTools"
                  value={formData.allowedTools}
                  onChange={(e) => setFormData({ ...formData, allowedTools: e.target.value })}
                  placeholder="e.g., filesystem, browser, calculator (comma-separated)"
                />
                <small>Comma-separated list of tool identifiers</small>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>Active (available for assignment)</span>
                </label>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
