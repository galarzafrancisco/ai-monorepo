import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useThreadsCtx } from "./ThreadsProvider";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { Text, Stack, Button, DataRowContainer } from "../../ui/primitives";
import { DeleteWithConfirmation } from "../../ui/components";
import type { Thread } from "./types";
import "./ThreadDetailPage.css";
import { ThreadContextCard } from "./ThreadContextCard";
import { ThreadTaskCard } from "./ThreadTaskCard";
import { ThreadTaskRow } from "./ThreadTaskRow";
import { ThreadChat } from "./ThreadChat";
import { TaskStatus, TASKS_STATUS } from "../../shared/const/taskStatus";
import { ThreadNavItemsForThreadId, THREADS_NAVEGATION_ITEMS } from "./const";

type ThreadTask = Thread["tasks"][number];

// Define the desired status order
const STATUS_ORDER = [
  TaskStatus.DONE,
  TaskStatus.FOR_REVIEW,
  TaskStatus.IN_PROGRESS,
  TaskStatus.NOT_STARTED,
] as const;

// Group tasks by status, with parent task first
const groupTasksByStatus = (thread: Thread) => {
  const parentTaskId = thread.parentTaskId;
  const parentTask = parentTaskId && typeof parentTaskId === 'string'
    ? thread.tasks.find((task) => task.id === parentTaskId)
    : null;

  const groups: Array<{
    status: TaskStatus | "parent";
    label: string;
    tasks: ThreadTask[];
  }> = [];

  // Add parent task group if it exists
  if (parentTask) {
    groups.push({
      status: "parent",
      label: "Parent Task",
      tasks: [parentTask],
    });
  }

  // Group remaining tasks by status
  const tasksByStatus: Record<TaskStatus, ThreadTask[]> = {
    [TaskStatus.DONE]: [],
    [TaskStatus.FOR_REVIEW]: [],
    [TaskStatus.IN_PROGRESS]: [],
    [TaskStatus.NOT_STARTED]: [],
  };

  thread.tasks.forEach((task) => {
    // Skip parent task as it's already added
    if (parentTaskId && task.id === parentTaskId) return;

    const status = task.status as TaskStatus;
    if (tasksByStatus[status]) {
      tasksByStatus[status].push(task);
    }
  });

  // Add status groups in the desired order
  STATUS_ORDER.forEach((status) => {
    if (tasksByStatus[status].length > 0) {
      groups.push({
        status,
        label: TASKS_STATUS[status].label,
        tasks: tasksByStatus[status],
      });
    }
  });

  return groups;
};

export function ThreadDetailPage() {
  const { id: threadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setSectionTitle, getThread, deleteThread } = useThreadsCtx();
  const isDesktop = useIsDesktop();

  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setNavItems } = useThreadsCtx();

  // Load thread details
  useEffect(() => {
    if (!threadId) return;
    setNavItems(ThreadNavItemsForThreadId(threadId));

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

  const handleDelete = async () => {
    await deleteThread(thread.id);
    navigate("/threads");
  };

  if (isDesktop) {
    return <ThreadDetailPageDesktop thread={thread} onDelete={handleDelete} />;
  } else {
    return <ThreadDetailPageMobile thread={thread} onDelete={handleDelete} />;
  }
}

function ThreadDetailPageDesktop({
  thread,
  onDelete,
}: {
  thread: Thread;
  onDelete: () => Promise<void>;
}) {
  const taskGroups = groupTasksByStatus(thread);

  return (
    <div className="thread-detail-page thread-detail-page--desktop">
      {/* Main content area */}
      <div className="thread-detail-page__main">
        <div className="thread-detail-page__content">
          <div className="thread-detail-page__header">
            <Text size="5" weight="bold">
              {thread.title}
            </Text>
            <div style={{ marginTop: "var(--space-2)" }}>
              <Text size="2" tone="muted">
                #{thread.id.slice(0, 6)}
              </Text>
            </div>

            <DeleteWithConfirmation
              className="thread-detail-page__actions"
              onDelete={onDelete}
            />
          </div>

          <div className="thread-detail-page__chat">
            <ThreadChat threadId={thread.id} />
          </div>
        </div>
      </div>

      {/* Right sidebar with context and tasks */}
      <div className="thread-detail-page__sidebar">
        {/* Tasks grouped by status */}
        {taskGroups.map((group) => (
          <div key={group.status} className="thread-detail-page__sidebar-section">
            <Text size="2" weight="semibold" className="thread-detail-page__sidebar-header">
              {group.label} ({group.tasks.length})
            </Text>
            <div className="thread-detail-page__sidebar-content">
              {group.tasks.map((task) => (
                <ThreadTaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        ))}

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
        {thread.tasks.length === 0 && thread.referencedContextBlocks.length === 0 && (
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

function ThreadDetailPageMobile({
  thread,
  onDelete,
}: {
  thread: Thread;
  onDelete: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const taskGroups = groupTasksByStatus(thread);

  return (
    <div className="thread-detail-page thread-detail-page--mobile">
      <div className="thread-detail-page__mobile-content">
        {/* Tasks grouped by status using TaskRow */}
        {taskGroups.map((group) => (
          <div key={group.status} className="thread-detail-page__mobile-section">
            <DataRowContainer title={group.label}>
              {group.tasks.map((task) => (
                <ThreadTaskRow
                  key={task.id}
                  task={task}
                  onClick={() => navigate(`/tasks/task/${task.id}`)}
                />
              ))}
            </DataRowContainer>
          </div>
        ))}

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

        <DeleteWithConfirmation
          className="thread-detail-page__actions"
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
