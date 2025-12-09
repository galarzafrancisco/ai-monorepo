import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChatService, AgentService } from 'shared';

export function AgentsChatSessionNew() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createSession = async () => {
      if (!agentId) {
        setError('Agent ID is required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Fetch agent details to get name for session title
        const agent = await AgentService.agentControllerGetAgent(agentId);

        // Create a new chat session
        const session = await ChatService.chatControllerCreateSession({
          agentId,
          title: `Chat with ${agent.name}`,
        });

        // Navigate to the newly created session
        navigate(`/agents/${agentId}/session/${session.id}`, { replace: true });
      } catch (err) {
        console.error('Failed to create session:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to create chat session'
        );
        setIsLoading(false);
      }
    };

    createSession();
  }, [agentId, navigate]);

  if (error) {
    return (
      <div className="agents-chat-session">
        <div className="agents-chat-header">
          <h2>Error Creating Session</h2>
        </div>
        <div className="agents-chat-messages">
          <div className="agents-chat-placeholder">
            <p style={{ color: 'red' }}>{error}</p>
            <button
              onClick={() => navigate('/agents')}
              style={{ marginTop: '1rem' }}
            >
              Back to Agents
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agents-chat-session">
      <div className="agents-chat-header">
        <h2>Creating Session...</h2>
      </div>
      <div className="agents-chat-messages">
        <div className="agents-chat-placeholder">
          <p>Setting up your chat session...</p>
          <p className="agents-chat-placeholder-hint">
            {isLoading ? 'Please wait' : 'Redirecting...'}
          </p>
        </div>
      </div>
    </div>
  );
}
