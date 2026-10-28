import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { io } from "socket.io-client";
import { Bot, Info } from "lucide-react";
import type { ThreadTokenUsageResponseDto } from "@taico/client/v2";
import {
  MessageCreatedWireEvent,
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
import { Text, Stack, Button, DataRowContainer, Chip, Avatar, ContextRail, RailSection, useRailOpen } from "../../ui/primitives";
import { DeleteWithConfirmation } from "../../ui/components";
import type { Thread } from "./types";
import { getUIWebSocketUrl } from "../../config/api";
import "./ThreadDetailPage.css";
import { ThreadContextCard } from "./ThreadContextCard";
import { ThreadTaskCard } from "./ThreadTaskCard";
import { ThreadTaskRow } from "./ThreadTaskRow";
import {
  isReminder,
  isSchedule,
  ThreadReminderList,
  ThreadScheduleList,
  ThreadTaskSubscriptionList,
} from "./ThreadWaitLists";
import { EditableThreadTitle } from "./EditableThreadTitle";
import { ThreadPullRequestList, ThreadPullRequestWatchList } from "./ThreadPullRequests";
import { isPullRequestWatch, useThreadPullRequests } from "./useThreadPullRequests";
import { ThreadChat } from "./ThreadChat";
import { ThreadPinControl } from "./ThreadPinControl";
import { useChatReadiness } from "../ai-models/useChatReadiness";
import { useThreadTokenUsage } from "./useThreadTokenUsage";
import { formatTokenCount } from "../../shared/helpers/tokenCount";
import { TaskStatus, TASKS_STATUS } from "../../shared/const/taskStatus";
import { ThreadNavItemsForThreadId, THREADS_NAVEGATION_ITEMS } from "./const";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { MAIN_NAVEGATION_ITEMS } from "../../shared/const/mainNavegationItems";
import { getActiveNavigationPath } from "../../shared/helpers/activeNavigationPath";
import { NavigationIcon } from "../../shared/components/NavigationIcon";
import { actorHandle, isDeactivated } from "../actors";

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

/**
 * Reminders, schedules, watched tasks and watched pull requests, in that
 * order, leaving out empty ones. Shown near the top of the thread's details (below participants on
 * desktop).
 */
const waitSections = (thread: Thread) => {
  const reminders = thread.timers.filter(isReminder);
  const schedules = thread.timers.filter(isSchedule);
  return [
    {
      key: "reminders",
      title: "Reminders",
      count: reminders.length,
      list: <ThreadReminderList threadId={thread.id} reminders={reminders} />,
    },
    {
      key: "schedules",
      title: "Schedules",
      count: schedules.length,
      list: <ThreadScheduleList threadId={thread.id} schedules={schedules} />,
    },
    {
      key: "watching",
      title: "Watching for completion",
      count: thread.taskSubscriptions.length,
      list: (
        <ThreadTaskSubscriptionList threadId={thread.id} subscriptions={thread.taskSubscriptions} />
      ),
    },
    {
      key: "watching-pull-requests",
      title: "Watching pull requests",
      count: thread.watches.filter(isPullRequestWatch).length,
      list: (
        <ThreadPullRequestWatchList threadId={thread.id} watches={thread.watches.filter(isPullRequestWatch)} />
      ),
    },
  ].filter((section) => section.count > 0);
};

const participantsSummary = (participants: Thread["participants"]) => {
  const agents = participants.filter((p) => String(p.type) === "agent").length;
  const humans = participants.length - agents;
  const parts: string[] = [];
  if (agents > 0) parts.push(`${agents} ${agents === 1 ? "agent" : "agents"}`);
  if (humans > 0) parts.push(`${humans} ${humans === 1 ? "human" : "humans"}`);
  return parts.join(" and ");
};

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
  const { usage: tokenUsage, refresh: refreshTokenUsage } = useThreadTokenUsage(threadId);

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
    threadTaskIdsRef.current = new Set([
      ...(thread?.tasks.map((task) => task.id) ?? []),
      ...(thread?.taskSubscriptions.map((subscription) => subscription.taskId) ?? []),
    ]);
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

    // Each agent reply is saved after its usage, so the figures are current by now.
    threadSocket.on(ThreadWireEvents.MESSAGE_CREATED, (event: MessageCreatedWireEvent) => {
      if (event.payload.threadId !== threadId) {
        return;
      }
      void refreshTokenUsage();
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
  }, [threadId, refreshThread, refreshTokenUsage]);

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
    return <ThreadDetailPageDesktop thread={thread} tokenUsage={tokenUsage} onDelete={handleDelete} onRenamed={(title) => setThread((prev) => (prev ? { ...prev, title } : prev))} />;
  } else {
    return <ThreadDetailPageMobile thread={thread} tokenUsage={tokenUsage} onDelete={handleDelete} />;
  }
}

/** Where a person sees how much of their ChatGPT plan they have used. */
const CHATGPT_MANAGE_USAGE_URL = 'https://chatgpt.com/settings/usage';

/** The model answering in this thread, marked with an icon so it reads as a model id. */
function ThreadModelLabel({ label, usesChatgptPlan }: { label: string; usesChatgptPlan: boolean }) {
  return (
    <>
      <span className="thread-detail-page__model" title="Model answering in this thread">
        <Bot size={14} strokeWidth={1.8} aria-hidden="true" />
        <Text size="1" tone="muted">
          {label}
        </Text>
      </span>
      {usesChatgptPlan ? (
        <span
          className="thread-detail-page__model"
          title="Your own ChatGPT plan answers the messages you write here"
        >
          <Text size="1" tone="muted">
            Using ChatGPT plan ·
          </Text>
          <a
            className="thread-detail-page__model-link"
            href={CHATGPT_MANAGE_USAGE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Manage usage
          </a>
        </span>
      ) : null}
    </>
  );
}

/**
 * Debug indicator: how many tokens the thread uses, as the model provider
 * reported them. Renders nothing until the figures have loaded.
 */
function ThreadTokenUsageLabel({ usage }: { usage: ThreadTokenUsageResponseDto | null }) {
  if (!usage) {
    return null;
  }

  const { contextTokens, inputTokens, outputTokens, steps } = usage;
  if (contextTokens === null && inputTokens === null && outputTokens === null) {
    return (
      <span
        className="thread-detail-page__token-usage"
        title={
          steps > 0
            ? "The model provider reported no token figures for this thread"
            : "No model step has reported token usage in this thread yet"
        }
      >
        <Text size="1" tone="muted">
          tokens n/a
        </Text>
      </span>
    );
  }

  const exact = (count: number | null) => (count === null ? "n/a" : count.toLocaleString("en-US"));
  const short = (count: number | null) => (count === null ? "n/a" : formatTokenCount(count));
  const total = inputTokens === null && outputTokens === null ? null : (inputTokens ?? 0) + (outputTokens ?? 0);

  return (
    <span
      className="thread-detail-page__token-usage"
      title={[
        "Token usage (debug)",
        `Context, input of the last model step: ${exact(contextTokens)}`,
        `Input, all ${steps} steps: ${exact(inputTokens)}`,
        `Output, all ${steps} steps: ${exact(outputTokens)}`,
      ].join("\n")}
    >
      <Text size="1" tone="muted">
        {short(contextTokens)} ctx · {short(total)} total
      </Text>
    </span>
  );
}

/** Whether the details panel is open, remembered across threads. */
const THREAD_RAIL_KEY = 'taico.threadRail.open';

function ThreadDetailPageDesktop({
  thread,
  tokenUsage,
  onDelete,
  onRenamed,
}: {
  thread: Thread;
  tokenUsage: ThreadTokenUsageResponseDto | null;
  onDelete: () => Promise<void>;
  onRenamed: (title: string) => void;
}) {
  const { conversationModel } = useChatReadiness();
  const [isSidebarOpen, setIsSidebarOpen] = useRailOpen(THREAD_RAIL_KEY, true);
  // Status groups collapsed in the sidebar; Done starts collapsed like past days on the board
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set<string>([TaskStatus.DONE]),
  );
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const taskGroups = groupTasksByStatus(thread);
  const contextBlocks = getContextBlocksForDisplay(thread);
  const pullRequests = useThreadPullRequests(thread);

  return (
    <div className="thread-detail-page thread-detail-page--desktop">
      {/* Main content area */}
      <div className="thread-detail-page__main">
        <div className="thread-detail-page__content">
          <div className="thread-detail-page__header">
            <div className="thread-detail-page__header-top">
              <div className="thread-detail-page__header-main">
                <div className="thread-detail-page__title-row">
                  <EditableThreadTitle
                    threadId={thread.id}
                    title={thread.title}
                    onRenamed={onRenamed}
                  />
                  <ThreadPinControl threadId={thread.id} />
                </div>
                <div className="thread-detail-page__meta-row">
                  <Chip color="gray">#{thread.id.slice(0, 6)}</Chip>
                  <Text size="1" tone="muted">
                    {thread.participants.length} participants
                  </Text>
                  {conversationModel && (
                    <ThreadModelLabel
                      label={`${conversationModel.modelId} via ${conversationModel.providerName}`}
                      usesChatgptPlan={conversationModel.usesChatgptPlan}
                    />
                  )}
                  <ThreadTokenUsageLabel usage={tokenUsage} />
                </div>
              </div>
            </div>
          </div>

          <div className="thread-detail-page__chat">
            <ThreadChat key={thread.id} threadId={thread.id} />
          </div>
        </div>
      </div>

      <ContextRail title="Details" icon={Info} size="narrow" open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        {thread.participants.length > 0 && (
          <RailSection title="Participants" count={participantsSummary(thread.participants)}>
            {thread.participants.map((participant) => (
              <div key={participant.id} className="thread-detail-page__participant">
                <Avatar
                  name={participant.displayName}
                  inactive={isDeactivated(participant)}
                  size="sm"
                  src={participant.avatarUrl || undefined}
                />
                <div className="thread-detail-page__participant-text">
                  <Text size="2" weight="medium">
                    {participant.displayName}
                  </Text>
                  <Text size="1" tone="muted">
                    {actorHandle(participant)}
                  </Text>
                </div>
              </div>
            ))}
          </RailSection>
        )}

        {/* What will wake the agent up: right after participants, so it is never missed */}
        {waitSections(thread).map((section) => (
          <RailSection key={section.key} title={section.title} count={section.count}>
            {section.list}
          </RailSection>
        ))}

        {/* Only shown when the thread's tasks or messages link pull requests */}
        {pullRequests.length > 0 && (
          <RailSection title="Pull requests" count={pullRequests.length}>
            <ThreadPullRequestList pullRequests={pullRequests} />
          </RailSection>
        )}

        {/* Tasks grouped by status */}
        {taskGroups.map((group) => (
          <RailSection
            key={group.status}
            title={group.label}
            count={`${group.tasks.length} ${group.tasks.length === 1 ? "task" : "tasks"}`}
            collapsible
            collapsed={collapsedGroups.has(group.status)}
            onCollapsedChange={() => toggleGroup(group.status)}
          >
            {group.tasks.map((task) => (
              <ThreadTaskCard key={task.id} task={task} />
            ))}
          </RailSection>
        ))}

        {contextBlocks.length > 0 && (
          <RailSection
            title="Context"
            count={`${contextBlocks.length} ${contextBlocks.length === 1 ? "block" : "blocks"}`}
          >
            {contextBlocks.map((contextBlock) => (
              <ThreadContextCard
                key={`${contextBlock.id}-${contextBlock.isStateMemory ? "state" : "reference"}`}
                contextBlock={contextBlock}
                isStateMemory={contextBlock.isStateMemory}
              />
            ))}
          </RailSection>
        )}

        {thread.tasks.length === 0 && contextBlocks.length === 0 && (
          <div className="thread-detail-page__sidebar-empty">
            <Text size="2" tone="muted">
              No context or tasks attached
            </Text>
          </div>
        )}

        <RailSection title="Delete" footer>
          <div className="thread-detail-page__sidebar-delete">
            <DeleteWithConfirmation
              className="thread-detail-page__delete-actions"
              onDelete={onDelete}
              size="md"
              deleteLabel="Delete thread"
              confirmLabel="Delete forever"
            />
          </div>
        </RailSection>
      </ContextRail>
    </div>
  );
}

function ThreadDetailPageMobile({
  thread,
  tokenUsage,
  onDelete,
}: {
  thread: Thread;
  tokenUsage: ThreadTokenUsageResponseDto | null;
  onDelete: () => Promise<void>;
}) {
  const { conversationModel } = useChatReadiness();
  const navigate = useNavigate();
  const taskGroups = groupTasksByStatus(thread);
  const contextBlocks = getContextBlocksForDisplay(thread);
  const pullRequests = useThreadPullRequests(thread);
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
          <Text size="2" weight="semibold" className="thread-detail-page__mobile-title">
            {thread.title}
          </Text>
          <div className="thread-detail-page__mobile-meta">
            <Text size="1" tone="muted">
              #{thread.id.slice(0, 6)} · {thread.participants.length} participants
            </Text>
            {conversationModel && (
              <ThreadModelLabel
                label={conversationModel.modelId}
                usesChatgptPlan={conversationModel.usesChatgptPlan}
              />
            )}
            <ThreadTokenUsageLabel usage={tokenUsage} />
          </div>
        </div>
        <ThreadPinControl threadId={thread.id} />
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
            <ThreadChat key={thread.id} threadId={thread.id} />
          </div>
        )}

        {mobileView === "tasks" && (
          <div className="thread-detail-page__mobile-scrollable">
            {waitSections(thread).map((section) => (
              <div key={section.key} className="thread-detail-page__mobile-section">
                <DataRowContainer title={section.title}>{section.list}</DataRowContainer>
              </div>
            ))}
            {pullRequests.length > 0 && (
              <div className="thread-detail-page__mobile-section">
                <DataRowContainer title="Pull requests">
                  <ThreadPullRequestList pullRequests={pullRequests} />
                </DataRowContainer>
              </div>
            )}
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
          {MAIN_NAVEGATION_ITEMS.map((item) => {
            const isActive = item.path === getActiveNavigationPath(location.pathname, MAIN_NAVEGATION_ITEMS);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`thread-detail-page__mobile-drawer-item ${isActive ? "thread-detail-page__mobile-drawer-item--active" : ""}`}
                onClick={onClose}
              >
                <NavigationIcon icon={item.icon} className="thread-detail-page__mobile-drawer-icon" />
                <span className="thread-detail-page__mobile-drawer-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
