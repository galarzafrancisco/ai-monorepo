import { useParams } from 'react-router-dom';

export function AgentsChatSession() {
  const { agentId, sessionId } = useParams<{ agentId: string; sessionId: string }>();

  return (
    <div className="agents-chat-session">
      <div className="agents-chat-header">
        <h2>Chat Session</h2>
        <div className="agents-chat-meta">
          <span>Agent ID: {agentId}</span>
          <span>Session ID: {sessionId}</span>
        </div>
      </div>

      <div className="agents-chat-messages">
        <div className="agents-chat-placeholder">
          <p>Chat conversation placeholder</p>
          <p className="agents-chat-placeholder-hint">
            This is where chat messages will appear
          </p>
        </div>
      </div>

      <div className="agents-chat-input">
        <input
          type="text"
          placeholder="Type your message..."
          className="agents-chat-input-field"
          disabled
        />
        <button className="agents-chat-send-button" disabled>
          Send
        </button>
      </div>
    </div>
  );
}
