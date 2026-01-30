import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useThreadsCtx } from "./ThreadsProvider";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { Text, Stack, Button } from "../../ui/primitives";
import type { Thread } from "./types";
import "./ThreadDetailPage.css";
import { ThreadContextCard } from "./ThreadContextCard";
import { ThreadTaskCard } from "./ThreadTaskCard";

export function ThreadDetailPage() {
  const { id: threadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setSectionTitle, getThread } = useThreadsCtx();
  const isDesktop = useIsDesktop();

  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load thread details
  useEffect(() => {
    if (!threadId) return;

    const loadThread = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const threadData = await getThread(threadId);
        setThread(threadData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load thread");
      } finally {
        setIsLoading(false);
      }
    };

    loadThread();
  }, [threadId, getThread]);

  // Set section title
  useEffect(() => {
    if (!thread) {
      setSectionTitle("Thread");
      return;
    }
    setSectionTitle(thread.title);
  }, [thread, setSectionTitle]);

  if (isLoading) {
    return (
      <div className="thread-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">
            Loading...
          </Text>
        </Stack>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="thread-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">
            {error || "Thread not found"}
          </Text>
          <Button variant="secondary" onClick={() => navigate("/threads")}>
            Back to threads
          </Button>
        </Stack>
      </div>
    );
  }

  if (isDesktop) {
    return <ThreadDetailPageDesktop thread={thread} />;
  } else {
    return <ThreadDetailPageMobile thread={thread} />;
  }
}

function ThreadDetailPageDesktop({ thread }: { thread: Thread }) {
  return (
    <div className="thread-detail-page thread-detail-page--desktop">
      {/* Main content area */}
      <div className="thread-detail-page__main">
        <div className="thread-detail-page__content">
          <Text size="5" weight="bold">
            {thread.title}
          </Text>
          <div style={{ marginTop: "var(--space-2)" }}>
            <Text size="2" tone="muted">
              #{thread.id.slice(0, 6)}
            </Text>
          </div>
        </div>
      </div>

      {/* Right sidebar with context and tasks */}
      <div className="thread-detail-page__sidebar">
        {/* Context section */}
        {thread.referencedContextBlocks.length > 0 && (
          <div className="thread-detail-page__sidebar-section">
            <Text size="2" weight="semibold" className="thread-detail-page__sidebar-header">
              Context ({thread.referencedContextBlocks.length})
            </Text>
            <div className="thread-detail-page__sidebar-content">
              {thread.referencedContextBlocks.map((contextBlock) => (
                <ThreadContextCard
                  key={contextBlock.id}
                  contextBlock={contextBlock}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tasks section */}
        {thread.tasks.length > 0 && (
          <div className="thread-detail-page__sidebar-section">
            <Text size="2" weight="semibold" className="thread-detail-page__sidebar-header">
              Tasks ({thread.tasks.length})
            </Text>
            <div className="thread-detail-page__sidebar-content">
              {thread.tasks.map((task) => (
                <ThreadTaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {thread.referencedContextBlocks.length === 0 &&
          thread.tasks.length === 0 && (
            <div className="thread-detail-page__sidebar-empty">
              <Text size="2" tone="muted">
                No context or tasks attached
              </Text>
            </div>
          )}
      </div>
    </div>
  );
}

function ThreadDetailPageMobile({ thread }: { thread: Thread }) {
  return (
    <div className="thread-detail-page thread-detail-page--mobile">
      <div className="thread-detail-page__mobile-content">
        {/* Participants section */}
        {thread.participants.length > 0 && (
          <div className="thread-detail-page__mobile-section">
            <Text size="2" weight="semibold">
              Participants ({thread.participants.length})
            </Text>
            <div className="thread-detail-page__mobile-list">
              {thread.participants.map((participant) => (
                <Text key={participant.id} size="2">
                  {participant.displayName} (@{participant.slug})
                </Text>
              ))}
            </div>
          </div>
        )}

        {/* Tasks section */}
        {thread.tasks.length > 0 && (
          <div className="thread-detail-page__mobile-section">
            <Text size="2" weight="semibold">
              Tasks ({thread.tasks.length})
            </Text>
            <div className="thread-detail-page__mobile-list">
              {thread.tasks.map((task) => (
                <ThreadTaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Context section */}
        {thread.referencedContextBlocks.length > 0 && (
          <div className="thread-detail-page__mobile-section">
            <Text size="2" weight="semibold">
              Context ({thread.referencedContextBlocks.length})
            </Text>
            <div className="thread-detail-page__mobile-list">
              {thread.referencedContextBlocks.map((contextBlock) => (
                <ThreadContextCard
                  key={contextBlock.id}
                  contextBlock={contextBlock}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
