import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, DataRowContainer, Text } from "../../ui/primitives";
import { Avatar, Chip } from "../../ui/primitives";
import { useThreadsCtx } from "./ThreadsProvider";
import { ThreadRow } from "./ThreadRow";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { useToast } from "../../shared/context/ToastContext";
import { useCommandPalette } from "../../ui/components";
import { useChatReadiness } from "../chat-providers/useChatReadiness";
import { ChatSetupCallout } from "../chat-providers/ChatSetupCallout";
import { useDraftState } from "../../shared/hooks/useDraftState";
import { ThreadsService } from "./api";
import { ThreadContextCard } from "./ThreadContextCard";
import { useAuth } from "../../auth";
import { useActorsCtx } from "../actors";
import './ThreadsPage.css';

export function ThreadsPage() {
  const { threads, setSectionTitle, createThread } = useThreadsCtx();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { showError, showToast } = useToast();
  const { registerCommands } = useCommandPalette();
  const { readiness, isReady: isChatReady, isLoading: isChatReadinessLoading } = useChatReadiness();

  // Set browser tab title
  useDocumentTitle();

  // Set page title
  useEffect(() => {
    setSectionTitle("Threads 🧵");
  }, [setSectionTitle]);

  const handleThreadClick = (threadId: string) => {
    navigate(`/threads/${threadId}`);
  };

  const handleNewThread = useCallback(async () => {
    if (isDesktop) {
      navigate('/threads');
      return;
    }

    if (!isChatReady) {
      showToast('Thread chat unlocks in Chat Settings.', 'info');
      navigate('/settings/chat');
      return;
    }

    try {
      const thread = await createThread();
      if (thread) {
        navigate(`/threads/${thread.id}`);
      }
    } catch (error) {
      console.error('Error creating thread');
      console.error(error);
      showError(error);
    }
  }, [createThread, isChatReady, navigate, showError, showToast]);

  // Register page-specific commands
  useEffect(() => {
    const commands = [
      {
        id: 'new-thread',
        label: 'New Thread',
        description: 'Create a new thread',
        aliases: ['create thread', 'add thread'],
        onSelect: handleNewThread,
      },
    ];

    return registerCommands(commands);
  }, [registerCommands, handleNewThread]);

  return (
    isDesktop ? (
      <DesktopNewThreadPage />
    ) : (
      <>
        {!isChatReadinessLoading && readiness && !readiness.isReady ? (
          <ChatSetupCallout
            title={readiness.title}
            description={readiness.description}
            ctaLabel={readiness.ctaLabel}
            onOpenSettings={() => navigate('/settings/chat')}
          />
        ) : null}

        <DataRowContainer>
          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              onClick={() => handleThreadClick(thread.id)}
            />
          ))}
        </DataRowContainer>

        <button
          className={`threads-fab ${isDesktop ? 'threads-fab--desktop' : ''}`}
          type="button"
          onClick={handleNewThread}
          disabled={!isChatReady || isChatReadinessLoading}
          aria-label="Create new thread"
        >
          {isDesktop ? (
            <>
              <span className="threads-fab__plus">+</span>
              <span className="threads-fab__label">New thread</span>
            </>
          ) : (
            '+'
          )}
        </button>
      </>
    )
  );
}

function DesktopNewThreadPage() {
  const navigate = useNavigate();
  const { createThread, optimisticDraftThread, setOptimisticDraftThread } = useThreadsCtx();
  const { showError } = useToast();
  const [draftState, setDraftState, clearDraft] = useDraftState({
    key: 'thread-chat-draft-new',
    defaultValue: { content: '' },
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const { readiness, isLoading: isChatReadinessLoading } = useChatReadiness();

  useEffect(() => {
    if (isChatReadinessLoading) return;
    messageInputRef.current?.focus();
  }, [isChatReadinessLoading]);

  const handleSendMessage = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draftState.content.trim();
    if (!content || isCreating) {
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setOptimisticDraftThread({
      title: "New thread",
      message: content,
    });
    setDraftState({ content: "" });

    try {
      const thread = await createThread();
      await ThreadsService.ThreadsController_createMessage({
        id: thread.id,
        body: { content },
      });
      clearDraft();
      setOptimisticDraftThread(null);
      navigate(`/threads/${thread.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start thread';
      setCreateError(message);
      setDraftState({ content });
      setOptimisticDraftThread(null);
      showError(error);
    } finally {
      setIsCreating(false);
    }
  }, [clearDraft, createThread, draftState.content, isCreating, navigate, setDraftState, setOptimisticDraftThread, showError]);

  if (optimisticDraftThread) {
    return (
      <OptimisticDesktopThread
        title={optimisticDraftThread.title}
        message={optimisticDraftThread.message}
      />
    );
  }

  return (
    <div className="threads-page-desktop">
      <div className="thread-detail-page__header">
        <div className="thread-detail-page__header-top">
          <div>
            <Text size="5" weight="bold">
              New thread
            </Text>
          </div>
        </div>
      </div>

      <div className="thread-chat threads-page-desktop__chat">
        <div className="thread-chat__messages" aria-label="New thread messages" />

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
                value={draftState.content}
                onChange={(event) => setDraftState({ content: event.target.value })}
                placeholder="Write a message..."
                rows={3}
                disabled={isCreating || isChatReadinessLoading}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendMessage(event);
                  }
                }}
              />
              <Button
                type="submit"
                variant="secondary"
                className="thread-chat__send-btn"
                disabled={!draftState.content.trim() || isCreating || isChatReadinessLoading}
              >
                {isCreating ? 'starting...' : 'send'}
              </Button>
            </div>
            {createError ? (
              <div className="thread-chat__status thread-chat__status--error">
                <Text size="1">{createError}</Text>
              </div>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}

function OptimisticDesktopThread({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const { user } = useAuth();
  const { actors } = useActorsCtx();
  const currentActor = actors.find((actor) => actor.id === user?.actorId);
  const authorName = currentActor?.displayName || user?.displayName || "You";
  const authorSlug = currentActor?.slug;
  const authorAvatarUrl = currentActor?.avatarUrl || undefined;

  return (
    <div className="thread-detail-page thread-detail-page--desktop threads-page-desktop__optimistic">
      <div className="thread-detail-page__main">
        <div className="thread-detail-page__content">
          <div className="thread-detail-page__header">
            <div className="thread-detail-page__header-top">
              <div>
                <Text size="5" weight="bold">
                  {title}
                </Text>
                <div className="thread-detail-page__meta-row">
                  <Chip color="gray">creating</Chip>
                  <Text size="1" tone="muted">
                    1 participant
                  </Text>
                </div>
              </div>
            </div>
          </div>

          <div className="thread-detail-page__chat">
            <div className="thread-chat">
              <div className="thread-chat__messages">
                <div className="thread-chat__message thread-chat__message--mine">
                  <div className="thread-chat__message-header">
                    <div className="thread-chat__author">
                      <Avatar name={authorName} src={authorAvatarUrl} size="xs" />
                      <Text size="1" weight="semibold">
                        {authorName}
                      </Text>
                      {authorSlug ? (
                        <Text size="1" tone="muted">
                          @{authorSlug}
                        </Text>
                      ) : null}
                    </div>
                    <Text size="1" tone="muted">
                      sending...
                    </Text>
                  </div>

                  <Text size="2">{message}</Text>
                </div>
              </div>

              <form className="thread-chat__input-form">
                <div className="thread-chat__composer-row">
                  <textarea
                    className="thread-chat__input"
                    placeholder="Write a message..."
                    rows={3}
                    disabled
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    className="thread-chat__send-btn"
                    disabled
                  >
                    starting...
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="thread-detail-page__sidebar threads-page-desktop__optimistic-sidebar">
        <div className="thread-detail-page__sidebar-scroll">
          <div className="thread-detail-page__sidebar-section">
            <Text size="2" weight="semibold" className="thread-detail-page__sidebar-header">
              Context (1)
            </Text>
            <div className="thread-detail-page__sidebar-content">
              <ThreadContextCard
                contextBlock={{
                  id: "creating",
                  title: "Thread state memory",
                }}
                isStateMemory
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
