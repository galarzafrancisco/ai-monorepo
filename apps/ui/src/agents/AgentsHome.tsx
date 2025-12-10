import { useNavigate } from 'react-router-dom';
import { useAgents } from './useAgents';

export function AgentsHome() {
  const navigate = useNavigate();
  const { agents, isLoading, error } = useAgents();

  return (
    <div className="agents-home">
      <div className="agents-home-header">
        <h2>Available Agents</h2>
        <p>Select an agent to start a new conversation</p>
      </div>

      {isLoading && <div className="agents-loading">Loading agents...</div>}

      {error && <div className="agents-error">Error: {error}</div>}

      {!isLoading && !error && agents.length === 0 && (
        <div className="agents-empty">No agents available. Create one in the admin panel.</div>
      )}

      <div className="agents-admin-grid">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="agent-admin-card"
            onClick={() => navigate(`/agents/${agent.slug || agent.id}/session/new`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate(`/agents/${agent.slug || agent.id}/session/new`);
              }
            }}
          >
            <div className="agent-admin-card-header">
              <h3>{agent.name}</h3>
              <span className={`agent-status ${agent.isActive ? 'active' : 'inactive'}`}>
                {agent.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="agent-slug">@{agent.slug}</p>
            <p className="agent-description">
              {typeof agent.description === 'string'
                ? agent.description
                : agent.description
                  ? JSON.stringify(agent.description)
                  : 'No description available'}
            </p>
            <p className="agent-tools">
              Tools: {agent.allowedTools.length > 0 ? agent.allowedTools.join(', ') : 'None'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
