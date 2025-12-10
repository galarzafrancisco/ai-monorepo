import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatService, OpenAPI } from './api';
import type { ChatSessionResponseDto, ChatMessageEventDto, ChatMessagePartDto } from 'shared';

type MessageRole = 'user' | 'assistant';

interface Message {
  id: string;
  role: MessageRole;
  parts: ChatMessagePartDto[];
  timestamp: Date;
  isStreaming?: boolean;
}

const resolveRole = (role?: string): MessageRole => (role === 'user' ? 'user' : 'assistant');

const mergeTextParts = (parts: ChatMessagePartDto[]): ChatMessagePartDto[] => {
  const merged: ChatMessagePartDto[] = [];

  for (const part of parts) {
    const isTextPart = part.text && !part.functionCall && !part.functionResponse;
    const last = merged[merged.length - 1];

    if (isTextPart && last?.text && !last.functionCall && !last.functionResponse) {
      merged[merged.length - 1] = {
        ...last,
        text: `${last.text}${part.text}`,
      };
    } else {
      merged.push(part);
    }
  }

  return merged;
};

const partsToText = (parts: ChatMessagePartDto[]) =>
  mergeTextParts(parts)
    .filter((p) => p.text)
    .map((p) => p.text)
    .join('');

const mapEventToMessage = (event: ChatMessageEventDto, isStreaming = false): Message => ({
  id: event.id,
  role: resolveRole(event.content.role),
  parts: mergeTextParts(event.content.parts),
  timestamp: new Date(event.timestamp),
  isStreaming,
});

export function AgentsChatSession() {
  const { agentId, sessionId } = useParams<{ agentId: string; sessionId: string }>();

  const [session, setSession] = useState<ChatSessionResponseDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingPartsRef = useRef<ChatMessagePartDto[]>([]);
  const streamingMessageIdRef = useRef<string | null>(null);

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

    const messageContent = inputValue.trim();
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      parts: [{ text: messageContent }],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    const streamingId = crypto.randomUUID?.() ?? `streaming-${Date.now()}`;
    streamingPartsRef.current = [];
    streamingMessageIdRef.current = streamingId;

    setMessages((prev) => [
      ...prev,
      {
        id: streamingId,
        role: 'assistant',
        parts: [],
        timestamp: new Date(),
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;

          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const event: ChatMessageEventDto = JSON.parse(data);
            const isPartial = event.partial !== false;
            const targetId = streamingMessageIdRef.current ?? event.id;

            if (isPartial) {
              streamingPartsRef.current = mergeTextParts([
                ...streamingPartsRef.current,
                ...event.content.parts,
              ]);

              setMessages((prev) => {
                const updated = [...prev];
                const index = updated.findIndex((msg) => msg.id === targetId);
                const streamingMessage: Message = {
                  id: targetId ?? `streaming-${Date.now()}`,
                  role: resolveRole(event.content.role),
                  parts: streamingPartsRef.current,
                  timestamp: new Date(),
                  isStreaming: true,
                };

                if (index >= 0) {
                  updated[index] = streamingMessage;
                } else {
                  updated.push(streamingMessage);
                }

                return updated;
              });
            } else {
              const finalMessage = mapEventToMessage(event, false);
              streamingPartsRef.current = [];

              setMessages((prev) => {
                const updated = [...prev];
                const index = updated.findIndex((msg) => msg.id === targetId || msg.id === event.id);
                const messageWithId = {
                  ...finalMessage,
                  id: finalMessage.id || targetId || `message-${Date.now()}`,
                };

                if (index >= 0) {
                  updated[index] = messageWithId;
                } else {
                  updated.push(messageWithId);
                }

                return updated;
              });

              streamingMessageIdRef.current = null;
            }
          } catch (error) {
            console.warn('Failed to parse SSE event:', data, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);

      const streamingIdCurrent = streamingMessageIdRef.current;
      streamingPartsRef.current = [];
      streamingMessageIdRef.current = null;

      setMessages((prev) => {
        const updated = [...prev];
        const errorMessage: Message = {
          id: streamingIdCurrent ?? `error-${Date.now()}`,
          role: 'assistant',
          parts: [
            {
              text: 'Sorry, I encountered an error processing your message.',
            },
          ],
          timestamp: new Date(),
          isStreaming: false,
        };

        const index = updated.findIndex((msg) => msg.id === streamingIdCurrent);
        if (index >= 0) {
          updated[index] = errorMessage;
        } else {
          updated.push(errorMessage);
        }

        return updated;
      });
    } finally {
      setIsSending(false);
    }
  };

  const renderMessagePart = (
    part: ChatMessagePartDto,
    role: MessageRole,
    isStreaming?: boolean
  ) => {
    const thinking = (part as { thinking?: string; thoughts?: string }).thinking ??
      (part as { thinking?: string; thoughts?: string }).thoughts;

    if (thinking) {
      return (
        <details className="chat-bubble bubble-thinking">
          <summary>🤔 Thinking</summary>
          <pre>{thinking}</pre>
        </details>
      );
    }

    if (part.functionCall) {
      return (
        <details className="chat-bubble bubble-tool-call">
          <summary>🛠️ Tool call: {part.functionCall.name}</summary>
          <pre>{JSON.stringify(part.functionCall.args, null, 2)}</pre>
        </details>
      );
    }

    if (part.functionResponse) {
      return (
        <details className="chat-bubble bubble-tool-response">
          <summary>📄 Tool response: {part.functionResponse.name}</summary>
          <pre>{JSON.stringify(part.functionResponse.response, null, 2)}</pre>
        </details>
      );
    }

    if (part.text) {
      return (
        <div className={`chat-bubble bubble-${role}`}>
          <div className="bubble-text">{part.text}</div>
          {isStreaming && <span className="typing-indicator">...</span>}
        </div>
      );
    }

    return null;
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
            {messages.map((message) => {
              const textContent = partsToText(message.parts);

              return (
                <div
                  key={message.id}
                  className={`agents-chat-message ${message.role} ${
                    message.isStreaming ? 'is-streaming' : ''
                  }`}
                >
                  <div className="agents-chat-message-role">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                    {message.isStreaming && <span className="agents-chat-streaming">typing…</span>}
                  </div>
                  <div className="agents-chat-bubbles">
                    {message.parts.length > 0 ? (
                      message.parts.map((part, partIndex) => (
                        <div key={`${message.id}-${partIndex}`} className="agents-chat-message-part">
                          {renderMessagePart(part, message.role, message.isStreaming)}
                        </div>
                      ))
                    ) : (
                      <div className={`chat-bubble bubble-${message.role}`}>
                        <div className="bubble-text">{textContent || '...'}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
