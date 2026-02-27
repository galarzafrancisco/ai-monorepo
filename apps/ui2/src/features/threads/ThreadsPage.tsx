import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataRowContainer } from "../../ui/primitives";
import { useThreadsCtx } from "./ThreadsProvider";
import { ThreadRow } from "./ThreadRow";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { useToast } from "../../shared/context/ToastContext";
import { useCommandPalette } from "../../ui/components";
import { NewThreadPop } from "./NewThreadPop";
import './ThreadsPage.css';

export function ThreadsPage() {
  const { threads, setSectionTitle, createThread } = useThreadsCtx();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { showError } = useToast();
  const { registerCommands } = useCommandPalette();
  const [showNewThreadPop, setShowNewThreadPop] = useState(false);

  // Set browser tab title
  useDocumentTitle();

  // Set page title
  useEffect(() => {
    setSectionTitle("Threads 🧵");
  }, [setSectionTitle]);

  // Register page-specific commands
  useEffect(() => {
    const commands = [
      {
        id: 'new-thread',
        label: 'New Thread',
        description: 'Create a new thread',
        aliases: ['create thread', 'add thread'],
        onSelect: () => setShowNewThreadPop(true),
      },
    ];

    return registerCommands(commands);
  }, [registerCommands]);

  const handleThreadClick = (threadId: string) => {
    navigate(`/threads/${threadId}`);
  };

  const handleNewThreadCancel = () => {
    setShowNewThreadPop(false);
  };

  const handleNewThreadSave = async ({ title }: { title?: string }): Promise<boolean> => {
    try {
      const thread = await createThread(title);
      if (thread) {
        navigate(`/threads/${thread.id}`);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error creating thread');
      console.error(error);
      showError(error);
      return false;
    }
  };

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
        onClick={() => setShowNewThreadPop(true)}
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

      {showNewThreadPop && (
        <NewThreadPop onCancel={handleNewThreadCancel} onSave={handleNewThreadSave} />
      )}
    </>
  );
}
