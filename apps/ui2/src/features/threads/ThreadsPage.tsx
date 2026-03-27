import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DataRowContainer } from "../../ui/primitives";
import { useThreadsCtx } from "./ThreadsProvider";
import { ThreadRow } from "./ThreadRow";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { useToast } from "../../shared/context/ToastContext";
import { useCommandPalette } from "../../ui/components";
import { useChatReadiness } from "../chat-providers/useChatReadiness";
import { ChatSetupCallout } from "../chat-providers/ChatSetupCallout";
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

      {/* Floating Action Button */}
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
  );
}
