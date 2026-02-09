import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useThreadsCtx } from "./ThreadsProvider";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { Text, Stack, Button } from "../../ui/primitives";
import type { Thread } from "./types";
import "./ThreadDetailPage.css";
import { ThreadContextCard } from "./ThreadContextCard";
import { ThreadTaskCard } from "./ThreadTaskCard";
import { elapsedTime } from "../../shared/helpers/elapsedTime";

type ThreadTask = Thread["tasks"][number];

const formatTaskStatus = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const getParentTask = (thread: Thread): ThreadTask | null => {
  if (!thread.tasks.length) {
    return null;
  }

  if (thread.parentTaskId) {
    return thread.tasks.find((task) => task.id === thread.parentTaskId) ?? thread.tasks[0];
  }

  return thread.tasks[0];
};

const getChildTasks = (thread: Thread, parentTask: ThreadTask | null) => {
  if (!parentTask) {
    return thread.tasks;
  }

  return thread.tasks.filter((task) => task.id !== parentTask.id);
};

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
  const parentTask = getParentTask(thread);
  const childTasks = getChildTasks(thread, parentTask);

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
          {parentTask && (
            <div className="thread-detail-page__parent-task">
              <Text size="3" weight="semibold">
                Parent task
              </Text>
              <ParentTaskOverview task={parentTask} />
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar with context and tasks */}
      <div className="thread-detail-page__sidebar">
        {/* Parent task section */}
        {parentTask && (
          <div className="thread-detail-page__sidebar-section">
            <Text size="2" weight="semibold" className="thread-detail-page__sidebar-header">
              Parent task
            </Text>
            <div className="thread-detail-page__sidebar-content">
              <ThreadTaskCard key={parentTask.id} task={parentTask} />
            </div>
          </div>
        )}

        {/* Tasks section */}
        {childTasks.length > 0 && (
          <div className="thread-detail-page__sidebar-section">
            <Text size="2" weight="semibold" className="thread-detail-page__sidebar-header">
              Tasks ({childTasks.length})
            </Text>
            <div className="thread-detail-page__sidebar-content">
              {childTasks.map((task) => (
                <ThreadTaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

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

        {/* Empty state */}
        {thread.referencedContextBlocks.length === 0 &&
          childTasks.length === 0 &&
          !parentTask && (
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
  const parentTask = getParentTask(thread);
  const childTasks = getChildTasks(thread, parentTask);

  return (
    <div className="thread-detail-page thread-detail-page--mobile">
      <div className="thread-detail-page__mobile-content">
        {parentTask && (
          <div className="thread-detail-page__mobile-section">
            <Text size="2" weight="semibold">
              Parent task
            </Text>
            <ParentTaskOverview task={parentTask} />
          </div>
        )}

        {/* Tasks section */}
        {childTasks.length > 0 && (
          <div className="thread-detail-page__mobile-section">
            <Text size="2" weight="semibold">
              Tasks ({childTasks.length})
            </Text>
            <div className="thread-detail-page__mobile-list">
              {childTasks.map((task) => (
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
      </div>
    </div>
  );
}

function ParentTaskOverview({ task }: { task: ThreadTask }) {
  const openQuestions = task.inputRequests.filter((i) => !i.resolvedAt).length;

  return (
    <div className="thread-detail-page__parent-card">
      <div className="thread-detail-page__parent-header">
        <div>
          <Text size="4" weight="semibold">
            {task.name}
          </Text>
          <Text size="2" tone="muted">
            #{task.id.slice(0, 6)}
          </Text>
        </div>
        <Text size="2" tone="muted">
          {elapsedTime(task.updatedAt)}
        </Text>
      </div>
      <Text size="2" className="thread-detail-page__task-description">
        {task.description || "No description provided."}
      </Text>
      <div className="thread-detail-page__task-meta">
        <div className="thread-detail-page__task-meta-item">
          <Text size="1" tone="muted">
            Status
          </Text>
          <Text size="2">{formatTaskStatus(task.status)}</Text>
        </div>
        <div className="thread-detail-page__task-meta-item">
          <Text size="1" tone="muted">
            Assignee
          </Text>
          <Text size="2">
            {task.assigneeActor ? `@${task.assigneeActor.slug}` : "Unassigned"}
          </Text>
        </div>
        <div className="thread-detail-page__task-meta-item">
          <Text size="1" tone="muted">
            Created by
          </Text>
          <Text size="2">{task.createdByActor.displayName}</Text>
        </div>
        <div className="thread-detail-page__task-meta-item">
          <Text size="1" tone="muted">
            Comments
          </Text>
          <Text size="2">{task.commentCount}</Text>
        </div>
        <div className="thread-detail-page__task-meta-item">
          <Text size="1" tone="muted">
            Open questions
          </Text>
          <Text size="2">{openQuestions}</Text>
        </div>
      </div>
    </div>
  );
}
