import { useNavigate } from 'react-router-dom';

export function AgentsHome() {
  const navigate = useNavigate();

  // Placeholder agents
  const agents = [
    {
      id: 'agent-1',
      name: 'Code Assistant',
      description: 'Helps with coding tasks and debugging',
      icon: '💻',
    },
    {
      id: 'agent-2',
      name: 'Documentation Writer',
      description: 'Creates and maintains documentation',
      icon: '📝',
    },
    {
      id: 'agent-3',
      name: 'Test Generator',
      description: 'Generates unit and integration tests',
      icon: '🧪',
    },
  ];

  return (
    <div className="agents-home">
      <div className="agents-home-header">
        <h2>Available Agents</h2>
        <p>Select an agent to start a new conversation</p>
      </div>

      <div className="agents-grid">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="agent-card"
            onClick={() => navigate(`/agents/${agent.id}/session/new`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate(`/agents/${agent.id}/session/new`);
              }
            }}
          >
            <div className="agent-card-icon">{agent.icon}</div>
            <h3 className="agent-card-title">{agent.name}</h3>
            <p className="agent-card-description">{agent.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
