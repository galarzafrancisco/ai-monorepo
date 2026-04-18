import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import {
  TaskAssignedWireEvent,
  TaskDeletedWireEvent,
  TaskStatusChangedWireEvent,
  TaskUpdatedWireEvent,
  TaskWireEvents,
  ThreadTitleUpdatedWireEvent,
  ThreadUpdatedWireEvent,
  ThreadWireEvents,
} from "@taico/events";
import { useThreadsCtx } from "./ThreadsProvider";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { Text, Stack, Button, DataRowContainer, Chip, Avatar } from "../../ui/primitives";
import { DeleteWithConfirmation } from "../../ui/components";
import type { Thread } from "./types";
import { getUIWebSocketUrl } from "../../config/api";
import "./ThreadDetailPage.css";
import { ThreadContextCard } from "./ThreadContextCard";
import { ThreadTaskCard } from "./ThreadTaskCard";
import { ThreadTaskRow } from "./ThreadTaskRow";
import { ThreadChat } from "./ThreadChat";
import { TaskStatus, TASKS_STATUS } from "../../shared/const/taskStatus";
import { ThreadNavItemsForThreadId, THREADS_NAVEGATION_ITEMS } from "./const";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";

type ThreadTask = Thread["tasks"][number];
type DisplayContextBlock = {
  id: string;
  title: string;
  isStateMemory: boolean;
};

const THREADS_SOCKET_URL = getUIWebSocketUrl('/threads');
const TASKS_SOCKET_URL = getUIWebSocketUrl('/tasks');

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

const getContextBlocksForDisplay = (thread: Thread): DisplayContextBlock[] => {
  const allBlocks: DisplayContextBlock[] = [
    {
      id: thread.stateContextBlockId,
      title: "Thread state memory",
      isStateMemory: true,
    },
  ];

  thread.referencedContextBlocks.forEach((contextBlock) => {
    if (contextBlock.id === thread.stateContextBlockId) {
      return;
    }
    allBlocks.push({
      id: contextBlock.id,
      title: contextBlock.title,
      isStateMemory: false,
    });
  });

  return allBlocks;
};

export function ThreadDetailPage() {
  const { id: threadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setSectionTitle, getThread, deleteThread } = useThreadsCtx();
  const isDesktop = useIsDesktop();

  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const threadTaskIdsRef = useRef<Set<string>>(new Set());

  const { setNavItems } = useThreadsCtx();

  // Set browser tab title
  useDocumentTitle(thread ? { thread: { title: thread.title } } : undefined);

  const refreshThread = useCallback(async () => {
    if (!threadId) return;

    try {
      const threadData = await getThread(threadId);
      setThread(threadData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load thread");
    }
  }, [threadId, getThread]);

  useEffect(() => {
    threadTaskIdsRef.current = new Set(thread?.tasks.map((task) => task.id) ?? []);
  }, [thread]);

  // Load thread details
  useEffect(() => {
    if (!threadId) return;
    setNavItems(ThreadNavItemsForThreadId(threadId));

    const loadThread = async () => {
      setIsLoading(true);
      await refreshThread();
      setIsLoading(false);
    };

    loadThread();
  }, [threadId, refreshThread, setNavItems]);

  useEffect(() => {
    if (!threadId) return;

    const threadSocket = io(THREADS_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    threadSocket.on('connect', () => {
      threadSocket.emit('threads.subscribe', { threadId });
      void refreshThread();
    });

    threadSocket.on(ThreadWireEvents.THREAD_UPDATED, (event: ThreadUpdatedWireEvent) => {
      if (event.payload.id !== threadId) {
        return;
      }
      void refreshThread();
    });

    threadSocket.on(ThreadWireEvents.THREAD_TITLE_UPDATED, (event: ThreadTitleUpdatedWireEvent) => {
      if (event.payload.threadId !== threadId) {
        return;
      }
      void refreshThread();
    });

    const taskSocket = io(TASKS_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    taskSocket.on('connect', () => {
      taskSocket.emit('tasks.subscribe', {});
      void refreshThread();
    });

    const refreshIfTaskBelongsToThread = (taskId: string) => {
      if (!threadTaskIdsRef.current.has(taskId)) {
        return;
      }
      void refreshThread();
    };

    taskSocket.on(TaskWireEvents.TASK_UPDATED, (event: TaskUpdatedWireEvent) => {
      refreshIfTaskBelongsToThread(event.payload.id);
    });

    taskSocket.on(TaskWireEvents.TASK_STATUS_CHANGED, (event: TaskStatusChangedWireEvent) => {
      refreshIfTaskBelongsToThread(event.payload.id);
    });

    taskSocket.on(TaskWireEvents.TASK_ASSIGNED, (event: TaskAssignedWireEvent) => {
      refreshIfTaskBelongsToThread(event.payload.id);
    });

    taskSocket.on(TaskWireEvents.TASK_DELETED, (event: TaskDeletedWireEvent) => {
      refreshIfTaskBelongsToThread(event.payload.taskId);
    });

    return () => {
      threadSocket.emit('threads.unsubscribe', { threadId });
      threadSocket.close();
      taskSocket.emit('tasks.unsubscribe', {});
      taskSocket.close();
    };
  }, [threadId, refreshThread]);

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const taskGroups = groupTasksByStatus(thread);
  const contextBlocks = getContextBlocksForDisplay(thread);

  return (
    <div className="thread-detail-page thread-detail-page--desktop">
      {/* Main content area */}
      <div className="thread-detail-page__main">
        <div className="thread-detail-page__content">
          <div className="thread-detail-page__header">
            <div className="thread-detail-page__header-top">
              <div>
                <Text size="5" weight="bold">
                  {thread.title}
                </Text>
                <div className="thread-detail-page__meta-row">
                  <Chip color="gray">#{thread.id.slice(0, 6)}</Chip>
                  <Text size="1" tone="muted">
                    {thread.participants.length} participants
                  </Text>
                </div>
              </div>
            </div>
          </div>

          <div className="thread-detail-page__chat">
            <ThreadChat threadId={thread.id} />
          </div>
        </div>
      </div>

      {/* Right sidebar with context and tasks */}
      <div className={`thread-detail-page__sidebar ${!isSidebarOpen ? "thread-detail-page__sidebar--collapsed" : ""}`}>
        {isSidebarOpen && (
          <div className="thread-detail-page__sidebar-scroll">
            {thread.participants.length > 0 && (
              <div className="thread-detail-page__sidebar-section">
                <Text size="2" weight="semibold" className="thread-detail-page__sidebar-header">
                  Participants ({thread.participants.length})
                </Text>
                <div className="thread-detail-page__participants">
                  {thread.participants.map((participant) => (
                    <div key={participant.id} className="thread-detail-page__participant">
                      <Avatar
                        name={participant.displayName}
                        size="sm"
                        src={participant.avatarUrl || undefined}
                      />
                      <div className="thread-detail-page__participant-text">
                        <Text size="2" weight="medium">
                          {participant.displayName}
                        </Text>
                        <Text size="1" tone="muted">
                          @{participant.slug}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            {contextBlocks.length > 0 && (
              <div className="thread-detail-page__sidebar-section">
                <Text size="2" weight="semibold" className="thread-detail-page__sidebar-header">
                  Context ({contextBlocks.length})
                </Text>
                <div className="thread-detail-page__sidebar-content">
                  {contextBlocks.map((contextBlock) => (
                    <ThreadContextCard
                      key={`${contextBlock.id}-${contextBlock.isStateMemory ? "state" : "reference"}`}
                      contextBlock={contextBlock}
                      isStateMemory={contextBlock.isStateMemory}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {thread.tasks.length === 0 && contextBlocks.length === 0 && (
              <div className="thread-detail-page__sidebar-empty">
                <Text size="2" tone="muted">
                  No context or tasks attached
                </Text>
              </div>
            )}

            <div className="thread-detail-page__sidebar-section thread-detail-page__sidebar-delete">
              <div className="thread-detail-page__sidebar-content thread-detail-page__sidebar-content--centered">
                <DeleteWithConfirmation
                  className="thread-detail-page__delete-actions"
                  onDelete={onDelete}
                  size="md"
                  deleteLabel="Delete thread"
                  confirmLabel="Delete forever"
                />
              </div>
            </div>
          </div>
        )}
        <button
          className="thread-detail-page__sidebar-toggle"
          onClick={() => setIsSidebarOpen((current) => !current)}
          aria-label={isSidebarOpen ? "Collapse details panel" : "Expand details panel"}
        >
          {isSidebarOpen ? "→" : "←"}
        </button>
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
  const contextBlocks = getContextBlocksForDisplay(thread);
  const [mobileView, setMobileView] = useState<"chat" | "tasks" | "context" | "more">("chat");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="thread-detail-page thread-detail-page--mobile">
      {/* Mobile drawer */}
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {/* Fixed header with burger menu */}
      <header className="thread-detail-page__mobile-header">
        <button
          className="thread-detail-page__mobile-burger"
          onClick={() => setIsDrawerOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="thread-detail-page__mobile-header-content">
          <Text size="2" weight="semibold">
            {thread.title}
          </Text>
          <Text size="1" tone="muted">
            #{thread.id.slice(0, 6)} · {thread.participants.length} participants
          </Text>
        </div>
      </header>

      {/* Fixed tab navigation */}
      <div className="thread-detail-page__mobile-tabs" role="tablist" aria-label="Thread mobile views">
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === "chat"}
          className={`thread-detail-page__mobile-tab ${mobileView === "chat" ? "thread-detail-page__mobile-tab--active" : ""}`}
          onClick={() => setMobileView("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === "tasks"}
          className={`thread-detail-page__mobile-tab ${mobileView === "tasks" ? "thread-detail-page__mobile-tab--active" : ""}`}
          onClick={() => setMobileView("tasks")}
        >
          Tasks
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === "context"}
          className={`thread-detail-page__mobile-tab ${mobileView === "context" ? "thread-detail-page__mobile-tab--active" : ""}`}
          onClick={() => setMobileView("context")}
        >
          Context
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === "more"}
          className={`thread-detail-page__mobile-tab ${mobileView === "more" ? "thread-detail-page__mobile-tab--active" : ""}`}
          onClick={() => setMobileView("more")}
        >
          More
        </button>
      </div>

      {/* Main content area - scrollable or fixed depending on view */}
      <div className="thread-detail-page__mobile-content">
        {mobileView === "chat" && (
          <div className="thread-detail-page__mobile-chat-container">
            <ThreadChat threadId={thread.id} />
          </div>
        )}

        {mobileView === "tasks" && (
          <div className="thread-detail-page__mobile-scrollable">
            {taskGroups.length > 0 ? (
              taskGroups.map((group) => (
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
              ))
            ) : (
              <div className="thread-detail-page__mobile-empty">
                <Text size="2" tone="muted">
                  No tasks attached
                </Text>
              </div>
            )}
          </div>
        )}

        {mobileView === "context" && (
          <div className="thread-detail-page__mobile-scrollable">
            {contextBlocks.length > 0 ? (
              <div className="thread-detail-page__mobile-section">
                <div className="thread-detail-page__mobile-list">
                  {contextBlocks.map((contextBlock) => (
                    <ThreadContextCard
                      key={`${contextBlock.id}-${contextBlock.isStateMemory ? "state" : "reference"}`}
                      contextBlock={contextBlock}
                      isStateMemory={contextBlock.isStateMemory}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="thread-detail-page__mobile-empty">
                <Text size="2" tone="muted">
                  No context blocks attached
                </Text>
              </div>
            )}
          </div>
        )}

        {mobileView === "more" && (
          <div className="thread-detail-page__mobile-scrollable">
            <div className="thread-detail-page__mobile-section">
              <Stack spacing="4">
                <Stack spacing="2">
                  <Text size="2" weight="semibold">
                    Thread Settings
                  </Text>
                  <Text size="2" tone="muted">
                    Manage this thread's settings and data.
                  </Text>
                </Stack>

                <div className="thread-detail-page__mobile-settings-section">
                  <Stack spacing="3">
                    <Text size="2" weight="semibold">
                      Attach Items (Coming Soon)
                    </Text>
                    <Stack spacing="2">
                      <Button variant="secondary" disabled className="thread-detail-page__mobile-settings-button">
                        Add Task
                      </Button>
                      <Button variant="secondary" disabled className="thread-detail-page__mobile-settings-button">
                        Add Context Block
                      </Button>
                    </Stack>
                  </Stack>
                </div>

                <div className="thread-detail-page__mobile-settings-section">
                  <Stack spacing="3">
                    <Text size="2" weight="semibold">
                      Danger Zone
                    </Text>
                    <DeleteWithConfirmation
                      className="thread-detail-page__mobile-delete-action"
                      onDelete={onDelete}
                      size="md"
                      deleteLabel="Delete Thread"
                      confirmLabel="Delete Forever"
                    />
                  </Stack>
                </div>
              </Stack>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mobile drawer component
function MobileDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const MAIN_NAV_ITEMS = [
    { path: "/dashboard", icon: "🏠", label: "Dashboard" },
    { path: "/threads", icon: "💬", label: "Threads" },
    { path: "/tasks", icon: "✓", label: "Tasks" },
    { path: "/context", icon: "📄", label: "Context" },
  ];

  return (
    <>
      {isOpen && (
        <div className="thread-detail-page__mobile-drawer-overlay" onClick={onClose} />
      )}
      <aside className={`thread-detail-page__mobile-drawer ${isOpen ? "thread-detail-page__mobile-drawer--open" : ""}`}>
        <div className="thread-detail-page__mobile-drawer-header">
          <Text size="4" weight="bold">taico</Text>
          <button
            className="thread-detail-page__mobile-drawer-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="thread-detail-page__mobile-drawer-nav">
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                className={`thread-detail-page__mobile-drawer-item ${isActive ? "thread-detail-page__mobile-drawer-item--active" : ""}`}
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
              >
                <span className="thread-detail-page__mobile-drawer-icon">{item.icon}</span>
                <span className="thread-detail-page__mobile-drawer-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
