import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Text, Button, Avatar } from "../../ui/primitives";
import { useThread } from "./useThread";
import { useAuth } from "../../auth";
import { useDraftState } from "../../shared/hooks/useDraftState";
import { useChatReadiness } from "../chat-providers/useChatReadiness";
import { ChatSetupCallout } from "../chat-providers/ChatSetupCallout";
import "./ThreadChat.css";

interface ThreadChatProps {
  threadId: string;
}

export function ThreadChat({ threadId }: ThreadChatProps) {
  const navigate = useNavigate();
  const [draftState, setDraftState, clearDraft] = useDraftState({
    key: `thread-chat-draft-${threadId}`,
    defaultValue: { content: "" },
  });
  const { content: newMessage } = draftState;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { readiness, isReady: isChatReady, isLoading: isChatReadinessLoading } = useChatReadiness();

  const {
    messages,
    agentActivity,
    agentResponseStream,
    sendMessage,
    chatIsSending,
    chatIsLoading,
    chatError,
    chatSendError,
  } = useThread(threadId);

  // Auto-scroll to bottom when messages/activity update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentActivity, agentResponseStream?.content]);

  useEffect(() => {
    if (!chatIsLoading) {
      messageInputRef.current?.focus();
    }
  }, [chatIsLoading, threadId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || chatIsSending) return;
    try {
      await sendMessage(newMessage);
      clearDraft();
      requestAnimationFrame(() => {
        messageInputRef.current?.focus();
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(messageDate);
  };

  // TODO: optimistic UI. Show the message we just sent. Right now we only show it if the websocket plays it back which I guess it's ok but slow
  
  if (chatIsLoading) {
    return (
      <div className="thread-chat">
        <Text size="2" tone="muted">
          Loading messages...
        </Text>
      </div>
    );
  }

  return (
    <div className="thread-chat">
      <div className="thread-chat__messages">
        {chatError && (
          <div className="thread-chat__status thread-chat__status--error">
            <Text size="2">{chatError}</Text>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="thread-chat__empty-state">
            <Text size="2" tone="muted">
              No messages yet. Start the conversation.
            </Text>
          </div>
        ) : (
          messages.map((message) => {
            const author = message.createdByActor;
            const isOwnMessage = Boolean(user?.actorId && user.actorId === message.createdByActorId);
            const authorName = author?.displayName || "Anonymous";
            const authorSlug = author?.slug;

            return (
              <div
                key={message.id}
                className={`thread-chat__message ${isOwnMessage ? "thread-chat__message--mine" : ""}`}
              >
                <div className="thread-chat__message-header">
                  <div className="thread-chat__author">
                    <Avatar name={authorName} src={author?.avatarUrl || undefined} size="xs" />
                    <Text size="1" weight="semibold">
                      {authorName}
                    </Text>
                    {authorSlug && (
                      <Text size="1" tone="muted">
                        @{authorSlug}
                      </Text>
                    )}
                  </div>

                  <Text size="1" tone="muted">
                    {formatMessageTime(message.createdAt)}
                  </Text>
                </div>

                <Text size="2">{message.content}</Text>
              </div>
            );
          })
        )}

        {agentResponseStream && (
          <div className="thread-chat__message thread-chat__message--streaming" role="status" aria-live="polite">
            <div className="thread-chat__message-header">
              <div className="thread-chat__author">
                <Avatar name="Assistant" size="xs" />
                <Text size="1" weight="semibold">
                  Assistant
                </Text>
              </div>
              <Text size="1" tone="muted">
                typing...
              </Text>
            </div>

            <Text size="2">{agentResponseStream.content}</Text>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {isChatReady && agentActivity && (
        <div className="thread-chat__activity" role="status" aria-live="polite">
          <Text size="1" tone="muted">
            {agentActivity === "thinking" ? "Assistant is thinking..." : "Assistant is calling a tool..."}
          </Text>
        </div>
      )}

      {!isChatReadinessLoading && readiness && !readiness.isReady ? (
        <div className="thread-chat__setup-callout">
          <ChatSetupCallout
            title={readiness.title}
            description={readiness.description}
            ctaLabel={readiness.ctaLabel}
            onOpenSettings={() => navigate('/settings/chat')}
          />
        </div>
      ) : (
        <form className="thread-chat__input-form" onSubmit={handleSendMessage}>
          <div className="thread-chat__composer-row">
            <textarea
              ref={messageInputRef}
              className="thread-chat__input"
              value={newMessage}
              onChange={(e) => setDraftState({ ...draftState, content: e.target.value })}
              placeholder="Write a message to this thread..."
              rows={3}
              disabled={chatIsSending || isChatReadinessLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <Button
              type="submit"
              variant="secondary"
              className="thread-chat__send-btn"
              disabled={!newMessage.trim() || chatIsSending || isChatReadinessLoading}
            >
              {chatIsSending ? "sending..." : "send"}
            </Button>
          </div>
          {chatSendError && (
            <div className="thread-chat__status thread-chat__status--error">
              <Text size="1">{chatSendError}</Text>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
