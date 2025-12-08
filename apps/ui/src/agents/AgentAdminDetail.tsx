import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgents } from './useAgents';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

export function AgentAdminDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const {
    selectedAgent,
    isLoading,
    error,
    loadAgentDetails,
    updateAgent,
    deleteAgent,
  } = useAgents();

  const [isEditing, setIsEditing] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    description: '',
    systemPrompt: '',
    allowedTools: '',
    isActive: true,
  });

  useEffect(() => {
    if (agentId) {
      loadAgentDetails(agentId);
    }
  }, [agentId]);

  useEffect(() => {
    if (selectedAgent) {
      setFormData({
        slug: selectedAgent.slug,
        name: selectedAgent.name,
        description: selectedAgent.description?.toString() || '',
        systemPrompt: selectedAgent.systemPrompt,
        allowedTools: selectedAgent.allowedTools.join(', '),
        isActive: selectedAgent.isActive,
      });
    }
  }, [selectedAgent]);

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId) return;
    try {
      await updateAgent(agentId, {
        slug: formData.slug,
        name: formData.name,
        description: formData.description,
        systemPrompt: formData.systemPrompt,
        allowedTools: formData.allowedTools.split(',').map(tool => tool.trim()).filter(Boolean),
        isActive: formData.isActive,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update agent', err);
    }
  };

  const handleDeleteAgent = async () => {
    if (!agentId) return;
    setConfirmState({
      message: 'Are you sure you want to delete this agent? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteAgent(agentId);
          setConfirmState(null);
          navigate('/agents/admin');
        } catch (err) {
          console.error('Failed to delete agent', err);
          setConfirmState(null);
        }
      },
    });
  };

  if (isLoading && !selectedAgent) {
    return <div className="loading">Loading agent details...</div>;
  }

  if (!selectedAgent) {
    return <div className="error-message">Agent not found</div>;
  }

  return (
    <div className="agent-admin-detail">
      <div className="agent-admin-detail-header">
        <div>
          <button onClick={() => navigate('/agents/admin')} className="btn-back">
            ← Back to Agents
          </button>
          <h1>{selectedAgent.name}</h1>
          <p className="agent-slug">@{selectedAgent.slug}</p>
          <span className={`agent-status ${selectedAgent.isActive ? 'active' : 'inactive'}`}>
            {selectedAgent.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="header-actions">
          {!isEditing ? (
            <>
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                Edit Agent
              </button>
              <button onClick={handleDeleteAgent} className="btn-delete">
                Delete Agent
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(false)} className="btn-secondary">
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {isEditing ? (
        <form onSubmit={handleUpdateAgent} className="agent-edit-form">
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
              rows={10}
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
            <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <div className="agent-detail-sections">
          <div className="detail-section">
            <h2>Basic Information</h2>
            <div className="detail-content">
              <div className="detail-field">
                <label>Name</label>
                <p>{selectedAgent.name}</p>
              </div>
              <div className="detail-field">
                <label>Slug</label>
                <p>@{selectedAgent.slug}</p>
              </div>
              <div className="detail-field">
                <label>Description</label>
                <p>{selectedAgent.description?.toString() || 'No description'}</p>
              </div>
              <div className="detail-field">
                <label>Status</label>
                <p>{selectedAgent.isActive ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h2>System Prompt</h2>
            <div className="detail-content">
              <pre className="system-prompt-display">{selectedAgent.systemPrompt}</pre>
            </div>
          </div>

          <div className="detail-section">
            <h2>Allowed Tools</h2>
            <div className="detail-content">
              {selectedAgent.allowedTools.length > 0 ? (
                <div className="tools-list">
                  {selectedAgent.allowedTools.map((tool, index) => (
                    <span key={index} className="tool-badge">{tool}</span>
                  ))}
                </div>
              ) : (
                <p className="empty-text">No tools configured</p>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h2>Metadata</h2>
            <div className="detail-content">
              <div className="detail-field">
                <label>Created At</label>
                <p>{new Date(selectedAgent.createdAt).toLocaleString()}</p>
              </div>
              <div className="detail-field">
                <label>Last Updated</label>
                <p>{new Date(selectedAgent.updatedAt).toLocaleString()}</p>
              </div>
              <div className="detail-field">
                <label>Row Version</label>
                <p>{selectedAgent.rowVersion}</p>
              </div>
            </div>
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
