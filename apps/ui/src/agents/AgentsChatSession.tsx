import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ChatService, OpenAPI } from './api';
import type { ChatSessionResponseDto, ChatMessageEventDto, ChatMessagePartDto } from 'shared';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  parts?: ChatMessagePartDto[];
  isStreaming?: boolean;
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
    const messageContent = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    // Add placeholder for assistant response
    const assistantMessageIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        parts: [],
        isStreaming: true,
      },
    ]);

    try {
      // Use fetch to establish SSE connection
      const response = await fetch(
        `${OpenAPI.BASE}/api/v1/chat/sessions/${sessionId}/messages/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: messageContent }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      const allEvents: ChatMessageEventDto[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const event: ChatMessageEventDto = JSON.parse(data);
              allEvents.push(event);

              // Update the assistant message with accumulated content
              setMessages((prev) => {
                const newMessages = [...prev];
                const assistantMsg = newMessages[assistantMessageIndex];
                if (assistantMsg) {
                  // Combine all text from all events
                  const combinedParts = allEvents.flatMap((e) => e.content.parts);
                  const text = combinedParts
                    .filter((p) => p.text)
                    .map((p) => p.text)
                    .join('');

                  assistantMsg.content = text;
                  assistantMsg.parts = combinedParts;
                  assistantMsg.isStreaming = event.partial !== false;
                }
                return newMessages;
              });
            } catch (error) {
              console.warn('Failed to parse SSE event:', data, error);
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages((prev) => {
        const newMessages = [...prev];
        const assistantMsg = newMessages[assistantMessageIndex];
        if (assistantMsg) {
          assistantMsg.isStreaming = false;
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Update the assistant message with error
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[assistantMessageIndex] = {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your message.',
          timestamp: new Date(),
          isStreaming: false,
        };
        return newMessages;
      });
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
                  {message.isStreaming && <span className="agents-chat-streaming"> (streaming...)</span>}
                </div>
                <div className="agents-chat-message-content">
                  {message.parts && message.parts.length > 0 ? (
                    <div className="agents-chat-message-parts">
                      {message.parts.map((part, partIndex) => (
                        <div key={partIndex} className="agents-chat-message-part">
                          {part.text && <div className="agents-chat-text">{part.text}</div>}
                          {part.functionCall && (
                            <div className="agents-chat-function-call">
                              <strong>🔧 Tool Call:</strong> {part.functionCall.name}
                              <details>
                                <summary>Arguments</summary>
                                <pre>{JSON.stringify(part.functionCall.args, null, 2)}</pre>
                              </details>
                            </div>
                          )}
                          {part.functionResponse && (
                            <div className="agents-chat-function-response">
                              <strong>✅ Tool Response:</strong> {part.functionResponse.name}
                              <details>
                                <summary>Result</summary>
                                <pre>{part.functionResponse.response.result}</pre>
                              </details>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
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
