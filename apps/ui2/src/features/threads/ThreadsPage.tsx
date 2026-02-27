import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DataRowContainer } from "../../ui/primitives";
import { useThreadsCtx } from "./ThreadsProvider";
import { ThreadRow } from "./ThreadRow";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { useToast } from "../../shared/context/ToastContext";
import { useCommandPalette } from "../../ui/components";
import './ThreadsPage.css';

export function ThreadsPage() {
  const { threads, setSectionTitle, createThread } = useThreadsCtx();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { showError } = useToast();
  const { registerCommands } = useCommandPalette();

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
  }, [createThread, navigate, showError]);

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
