import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Text, Button, Avatar } from "../../ui/primitives";
import { LoadEarlier, useLoadEarlier } from "../../ui/components";
import { useThread } from "./useThread";
import { useMarkThreadRead } from "./useMarkThreadRead";
import { useAuth } from "../../auth";
import { actorHandle, isDeactivated } from "../actors";
import { useDraftState } from "../../shared/hooks/useDraftState";
import { useChatReadiness } from "../ai-models/useChatReadiness";
import { ThreadChatLocked } from "./ThreadChatLocked";
import { useChatScrollFollow } from "./useChatScrollFollow";
import Markdown from "marked-react";
import { pullRequestMarkdownRenderer } from "../pull-requests";
import { ArrowDown } from "lucide-react";
import { TraceEntryView, isEntryWorking } from "../tasks/traces/RunTrace";
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  /** The list's scroll height just before older messages were asked for. */
  const keepScrollPositionRef = useRef(false);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { readiness, isLoading: isChatReadinessLoading } = useChatReadiness();
  const lockedKind = !isChatReadinessLoading && readiness && readiness.kind !== "ready" ? readiness.kind : null;
  const openModelSettings = () => navigate("/settings/models");

  const {
    messages,
    agentActivity,
    activityEntries,
    agentResponseStream,
    sendMessage,
    chatIsSending,
    chatIsLoading,
    chatError,
    chatSendError,
    hasOlderMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
  } = useThread(threadId);

  useMarkThreadRead(
    threadId,
    messages.length > 0 ? messages[messages.length - 1].id : null,
    !chatIsLoading && !chatError,
  );

  // Scrolling up loads older messages, keeping the ones on screen where they are.
  const { sentinelRef: olderSentinelRef, loadEarlier: loadEarlierMessages } = useLoadEarlier({
    containerRef: messagesContainerRef,
    hasMore: hasOlderMessages,
    isLoading: isLoadingOlderMessages,
    load: loadOlderMessages,
    itemSelector: ".thread-chat__message",
    contentDeps: [messages],
    onRestored: () => { keepScrollPositionRef.current = true; },
  });

  // Follow new activity only while the reader is at the bottom. When they've
  // scrolled up, a new message raises a "jump to latest" button instead.
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const { hasNewMessages, scrollToBottom } = useChatScrollFollow({
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    followDeps: [messages, activityEntries, agentResponseStream?.content, chatIsLoading],
    lastMessageId: lastMessage?.id ?? null,
    lastMessageIsOwn: Boolean(user?.actorId && lastMessage?.createdByActorId === user.actorId),
    resetKey: threadId,
    enabled: !chatIsLoading,
    skipNextFollowRef: keepScrollPositionRef,
  });

  useEffect(() => {
    if (!chatIsLoading) {
      messageInputRef.current?.focus();
    }
  }, [chatIsLoading, threadId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || chatIsSending || lockedKind) return;
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
      {/* Nothing to read yet: cover the whole chat. Otherwise cover only the composer. */}
      {lockedKind && messages.length === 0 && (
        <ThreadChatLocked kind={lockedKind} variant="full" onOpenSettings={openModelSettings} />
      )}
      <div className="thread-chat__messages-wrap">
        <div
          className="thread-chat__messages thin-scrollbar"
          ref={messagesContainerRef}
          inert={Boolean(lockedKind && messages.length === 0)}
        >
          <LoadEarlier
            sentinelRef={olderSentinelRef}
            hasMore={hasOlderMessages}
            isLoading={isLoadingOlderMessages}
            onLoad={loadEarlierMessages}
            noun="messages"
          />

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
              const authorHandle = author ? actorHandle(author) : null;

              return (
                <div
                  key={message.id}
                  className={`thread-chat__message ${isOwnMessage ? "thread-chat__message--mine" : ""}`}
                >
                  <div className="thread-chat__message-header">
                    <div className="thread-chat__author">
                      <Avatar name={authorName} inactive={isDeactivated(author)} src={author?.avatarUrl || undefined} size="xs" />
                      <Text size="1" weight="semibold">
                        {authorName}
                      </Text>
                      {authorHandle && (
                        <Text size="1" tone="muted">
                          {authorHandle}
                        </Text>
                      )}
                    </div>

                    <Text size="1" tone="muted">
                      {formatMessageTime(message.createdAt)}
                    </Text>
                  </div>

                  <div className="thread-chat__message-content">
                    <Markdown renderer={pullRequestMarkdownRenderer}>{message.content}</Markdown>
                  </div>
                </div>
              );
            })
          )}

          {activityEntries.length > 0 && (
            <div className="thread-chat__trace task-traces" aria-label="Assistant activity" aria-live="polite">
              <div className="task-traces__timeline">
                {activityEntries.map((entry, index) => (
                  <TraceEntryView
                    key={entry.id}
                    entry={entry}
                    live={Boolean(agentActivity) && index === activityEntries.length - 1}
                  />
                ))}
              </div>
              {agentActivity && !isEntryWorking(activityEntries[activityEntries.length - 1]) && (
                <div className="task-traces__working" role="status"><span className="shimmer-text">Working…</span></div>
              )}
            </div>
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

              <div className="thread-chat__message-content">
                <Markdown renderer={pullRequestMarkdownRenderer}>{agentResponseStream.content}</Markdown>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {hasNewMessages && (
          <button
            type="button"
            className="thread-chat__jump-latest"
            onClick={() => scrollToBottom()}
            aria-label="Jump to the latest message"
          >
            <ArrowDown size={14} aria-hidden="true" />
            <Text as="span" size="1">
              new messages
            </Text>
          </button>
        )}
      </div>

      <div className="thread-chat__composer">
        {lockedKind && messages.length > 0 && (
          <ThreadChatLocked kind={lockedKind} variant="composer" onOpenSettings={openModelSettings} />
        )}
        <form className="thread-chat__input-form" onSubmit={handleSendMessage} inert={Boolean(lockedKind)}>
          <div className="thread-chat__composer-row">
            <textarea
              ref={messageInputRef}
              className="thread-chat__input"
              value={newMessage}
              onChange={(e) => setDraftState({ ...draftState, content: e.target.value })}
              placeholder="Write a message to this thread..."
              rows={3}
              disabled={chatIsSending || isChatReadinessLoading || Boolean(lockedKind)}
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
              disabled={!newMessage.trim() || chatIsSending || isChatReadinessLoading || Boolean(lockedKind)}
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
      </div>
    </div>
  );
}
