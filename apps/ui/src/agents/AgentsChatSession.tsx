import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ChatService } from './api';
import type { ChatSessionResponseDto } from 'shared';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AgentsChatSession() {
  const { agentId, sessionId } = useParams<{ agentId: string; sessionId: string }>();

  const [session, setSession] = useState<ChatSessionResponseDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load session details
  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSession = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const sessionData = await ChatService.chatControllerGetSession(sessionId);
      setSession(sessionData);
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || !sessionId || isSending) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const response = await ChatService.chatControllerSendMessage(sessionId, {
        message: userMessage.content,
      });

      // Parse events from response
      if (response.events && Array.isArray(response.events)) {
        // Find assistant messages in events
        const assistantContent = response.events
          .filter((event: any) => event.type === 'message' || event.message)
          .map((event: any) => event.message || event.content)
          .join('\n');

        if (assistantContent) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="agents-chat-session">
        <div className="agents-loading">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="agents-chat-session">
      <div className="agents-chat-header">
        <h2>{session?.title || 'Chat Session'}</h2>
        <div className="agents-chat-meta">
          <span>Agent: {agentId}</span>
        </div>
      </div>

      <div className="agents-chat-messages">
        {messages.length === 0 ? (
          <div className="agents-chat-placeholder">
            <p>Start a conversation</p>
            <p className="agents-chat-placeholder-hint">
              Send a message to begin chatting with the agent
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`agents-chat-message ${message.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="agents-chat-message-role">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="agents-chat-message-content">{message.content}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form className="agents-chat-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type your message..."
          className="agents-chat-input-field"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isSending}
        />
        <button
          className="agents-chat-send-button"
          type="submit"
          disabled={isSending || !inputValue.trim()}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
