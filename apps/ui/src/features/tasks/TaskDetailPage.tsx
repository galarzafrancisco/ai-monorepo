import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTasksCtx } from './TasksProvider';
import { TasksService } from './api';
import { TaskStatus, TASKS_STATUS } from './const';
import { Text, Stack, Button, Avatar, DataRow, ErrorText, DataRowTag, DataRowContainer } from '../../ui/primitives';
import { DeleteWithConfirmation, useCommandPalette } from '../../ui/components';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { NewCommentPop } from './NewCommentPop';
import { AnswerInputRequestPop } from './AnswerInputRequestPop';
import { TagSearchPop } from './TagSearchPop';
import { TaskSearchPop } from './TaskSearchPop';
import { ActorSearchPop, Actor, useActorsCtx } from '../actors';
import { useAuth } from '../../auth/AuthContext';
import {
  InputRequestResponseDto,
  ActiveTaskExecutionResponseDto,
  TaskExecutionHistoryResponseDto,
} from "@taico/client/v2";
import { MetaTagResponseDto } from "@taico/client";
import { TaskActivityWireEvent } from '@taico/events';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { ThreadsService } from '../threads/api';
import { ExecutionsService } from '../executions/api';
import type { Task } from './types';
import { useChatReadiness } from '../chat-providers/useChatReadiness';
import { ChatSetupCallout } from '../chat-providers/ChatSetupCallout';
import { TaskRow } from './TaskRow';
import './TaskDetailPage.css';

type TaskDetailHandlers = {
  addComment: (payload: { taskId: string; comment: string }) => Promise<unknown>;
  deleteTask: (payload: { taskId: string }) => Promise<unknown>;
  assignTask: (payload: { taskId: string; assigneeActorId: string }) => Promise<unknown>;
  assignTaskToMe: (payload: { taskId: string }) => Promise<unknown>;
  answerInputRequest: (payload: { taskId: string; inputRequestId: string; answer: string }) => Promise<unknown>;
  changeStatus: (payload: { taskId: string; status: TaskStatus }) => Promise<unknown>;
  addTag: (payload: { taskId: string; tag: MetaTagResponseDto }) => Promise<unknown>;
  removeTag: (payload: { taskId: string; tagId: string }) => Promise<unknown>;
  addDependency: (payload: { taskId: string; dependencyTaskId: string }) => Promise<unknown>;
  removeDependency: (payload: { taskId: string; dependencyTaskId: string }) => Promise<unknown>;
};

export type TaskDetailViewProps = {
  task?: Task;
  backPath: string;
  setSectionTitle: (title: string) => void;
  isLoadingTask?: boolean;
  activityByTaskId?: Record<string, TaskActivityWireEvent>;
  handlers: TaskDetailHandlers;
  allTasks: Task[];
};

type TaskExecutionListItem = {
  id: string;
  executionId: string;
  agentActorId: string;
  status: 'ACTIVE' | TaskExecutionHistoryResponseDto['status'];
  source: 'active' | 'history';
  timestamp: string;
  runnerSessionId: string | null;
  toolCallCount: number;
  errorCode: TaskExecutionHistoryResponseDto['errorCode'] | null;
  errorMessage: string | null;
};

const COLLAPSED_TIMELINE_COUNT = 3;
const COLLAPSED_EXECUTION_COUNT = 3;

export function TaskDetailView({ task, backPath, setSectionTitle, isLoadingTask = false, activityByTaskId = {}, handlers, allTasks }: TaskDetailViewProps) {
  const navigate = useNavigate();
  const { actors } = useActorsCtx();
  const { user } = useAuth();
  const { showError, showToast } = useToast();
  const { registerCommands } = useCommandPalette();
  const { readiness, isReady: isChatReady, isLoading: isChatReadinessLoading } = useChatReadiness();

  const [liveActivity, setLiveActivity] = useState<TaskActivityWireEvent | null>(null);
  const [activityPhase, setActivityPhase] = useState<'idle' | 'enter' | 'exit'>('idle');
  const [showAllTimelineItems, setShowAllTimelineItems] = useState(false);
  const [showAllExecutions, setShowAllExecutions] = useState(false);
  const activityHideTimerRef = useRef<number | null>(null);
  const activityExitTimerRef = useRef<number | null>(null);

  const ACTIVITY_VISIBLE_MS = 3500;
  const ACTIVITY_EXIT_MS = 220;

  useDocumentTitle({ task: { name: task?.name } });

  const handleChangeStatusForPalette = useCallback(async (status: TaskStatus) => {
    if (!task) return;
    try {
      await handlers.changeStatus({ taskId: task.id, status });
    } catch (err: unknown) {
      showError(err);
    }
  }, [task, handlers, showError]);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [isResolvingThread, setIsResolvingThread] = useState(false);

  const handleOpenOrCreateThread = useCallback(async () => {
    if (!task) {
      return;
    }

    if (!isChatReady) {
      showToast('Thread chat unlocks in Chat Settings.', 'info');
      navigate('/settings/chat');
      return;
    }

    setIsResolvingThread(true);
    try {
      if (threadId) {
        navigate(`/threads/${threadId}`);
        return;
      }

      const createdThread = await ThreadsService.ThreadsController_createThread({
        body: {
          title: task.name,
          parentTaskId: task.id,
        },
      });
      setThreadId(createdThread.id);
      navigate(`/threads/${createdThread.id}`);
    } catch (err: unknown) {
      showError(err);
    } finally {
      setIsResolvingThread(false);
    }
  }, [task, threadId, isChatReady, navigate, showError, showToast]);

  useEffect(() => {
    if (!task) {
      setThreadId(null);
      return;
    }

    let cancelled = false;
    setIsResolvingThread(true);

    void ThreadsService.ThreadsController_getThreadByTaskId({ taskId: task.id })
      .then((thread) => {
        if (!cancelled) {
          setThreadId(thread?.id ?? null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          showError(err);
          setThreadId(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsResolvingThread(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [task, showError]);

  // Look up dependency tasks from the real-time tasks array.
  // The useTasks hook already maintains a real-time updated tasks array via WebSocket.
  // Missing dependencies are hydrated by the useEffect above to ensure they're always in the cache.
  const dependencyTasks = useMemo(() => {
    if (!task || !task.dependsOnIds || task.dependsOnIds.length === 0) {
      return [];
    }
    return task.dependsOnIds
      .map(id => allTasks.find(t => t.id === id))
      .filter((t): t is Task => t !== undefined);
  }, [task, allTasks]);

  useEffect(() => {
    if (!task) return;

    const statusAliases: Record<TaskStatus, string[]> = {
      [TaskStatus.NOT_STARTED]: ['not started', 'to do', 'todo', 'queued'],
      [TaskStatus.IN_PROGRESS]: ['in progress', 'doing', 'building'],
      [TaskStatus.FOR_REVIEW]: ['for review', 'review', 'in review'],
      [TaskStatus.DONE]: ['done', 'shipped', 'release', 'complete'],
    };

    const statusCommands = Object.entries(TASKS_STATUS).map(([status, info]) => ({
      id: `task-status-${status}`,
      label: info.label,
      description: `Mark task as ${info.label.toLowerCase()}`,
      aliases: statusAliases[status as TaskStatus],
      onSelect: () => handleChangeStatusForPalette(status as TaskStatus),
    }));

    const actionCommands = [
      {
        id: 'task-add-comment',
        label: 'Comment',
        description: 'Add a comment to this task',
        aliases: ['add comment', 'note'],
        onSelect: () => setShowNewCommentPop(true),
      },
      {
        id: 'task-assign',
        label: 'Assign',
        description: 'Assign this task to someone',
        aliases: ['reassign', 'assignee'],
        onSelect: () => setShowAssignPop(true),
      },
      {
        id: 'task-assign-to-me',
        label: 'Assign to Me',
        description: 'Assign this task to yourself',
        aliases: ['claim', 'take'],
        onSelect: () => {
          handlers.assignTaskToMe({ taskId: task.id }).catch(showError);
        },
      },
      {
        id: 'task-add-tag',
        label: 'Tag',
        description: 'Add a tag to this task',
        aliases: ['add tag', 'label'],
        onSelect: () => setShowTagPop(true),
      },
      {
        id: 'task-thread-action',
        label: threadId ? 'Go to thread' : 'Create thread',
        description: threadId ? 'Open this task thread' : 'Create a thread from this task',
        aliases: ['thread', 'open thread', 'create thread', 'chat'],
        onSelect: () => {
          void handleOpenOrCreateThread();
        },
      },
    ];

    return registerCommands([...statusCommands, ...actionCommands]);
  }, [task, registerCommands, handleChangeStatusForPalette, handlers, showError, threadId, handleOpenOrCreateThread]);

  useEffect(() => {
    if (isLoadingTask) {
      setSectionTitle('Loading task...');
      return;
    }
    if (!task) {
      setSectionTitle('Task');
      return
    }
    setSectionTitle(task.name);
  }, [task, isLoadingTask, setSectionTitle]);

  useEffect(() => {
    return () => {
      if (activityHideTimerRef.current) {
        window.clearTimeout(activityHideTimerRef.current);
      }
      if (activityExitTimerRef.current) {
        window.clearTimeout(activityExitTimerRef.current);
      }
    };
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [executions, setExecutions] = useState<TaskExecutionListItem[]>([]);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);
  const [executionsError, setExecutionsError] = useState<string | null>(null);
  const [expandedExecutionErrorIds, setExpandedExecutionErrorIds] = useState<Set<string>>(new Set());
  const [interruptingExecutions, setInterruptingExecutions] = useState<Set<string>>(new Set());

  const [showNewCommentPop, setShowNewCommentPop] = useState(false);
  const [showAssignPop, setShowAssignPop] = useState(false);
  const [showTagPop, setShowTagPop] = useState(false);
  const [showDependencyPop, setShowDependencyPop] = useState(false);
  const [respondingToInputRequest, setRespondingToInputRequest] = useState<InputRequestResponseDto | null>(null);

  const toggleExecutionErrorDetails = useCallback((executionId: string) => {
    setExpandedExecutionErrorIds((prev) => {
      const next = new Set(prev);
      if (next.has(executionId)) {
        next.delete(executionId);
      } else {
        next.add(executionId);
      }
      return next;
    });
  }, []);

  const handleInterruptExecution = useCallback(async (executionId: string, taskName: string | undefined, taskId: string) => {
    if (!confirm(`Are you sure you want to interrupt the active execution for "${taskName ?? "this task"}"?`)) {
      return;
    }

    setInterruptingExecutions((prev) => new Set(prev).add(executionId));

    try {
      await ExecutionsService.ActiveTaskExecutionController_interruptExecution({ executionId });
      showToast(`Interrupt signal sent for "${taskName ?? "this task"}"`);
    } catch (err) {
      showError(err);
    } finally {
      setInterruptingExecutions((prev) => {
        const next = new Set(prev);
        next.delete(executionId);
        return next;
      });
    }
  }, [showToast, showError]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!task || event.defaultPrevented) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (showNewCommentPop || showAssignPop || showTagPop || showDependencyPop || respondingToInputRequest) {
        return;
      }

      if (isTextInputTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'a') {
        event.preventDefault();
        setShowAssignPop(true);
      } else if (key === 'c') {
        event.preventDefault();
        setShowNewCommentPop(true);
      } else if (key === 't') {
        event.preventDefault();
        setShowTagPop(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task, showNewCommentPop, showAssignPop, showTagPop, showDependencyPop, respondingToInputRequest]);

  const saveNewComment = async ({ content }: { content: string }): Promise<boolean> => {
    if (!task) {
      return false;
    }
    try {
      await handlers.addComment({
        taskId: task.id,
        comment: content,
      });
      return true;
    } catch (err: unknown) {
      showError(err);
      return false;
    }
  }
  const cancelNewComment = () => {
    setShowNewCommentPop(false);
  }

  const saveAssignment = async (actor: Actor): Promise<boolean> => {
    if (!task) {
      return false;
    }
    try {
      await handlers.assignTask({
        taskId: task.id,
        assigneeActorId: actor.id,
      });
      return true;
    } catch (err: unknown) {
      showError(err);
      return false;
    }
  }
  const cancelAssignment = () => {
    setShowAssignPop(false);
  }

  const saveAnswerToInputRequest = async ({ answer }: { answer: string }): Promise<boolean> => {
    if (!task || !respondingToInputRequest) {
      return false;
    }
    try {
      await handlers.answerInputRequest({
        taskId: task.id,
        inputRequestId: respondingToInputRequest.id,
        answer,
      });
      return true;
    } catch (err: unknown) {
      showError(err);
      return false;
    }
  }
  const cancelAnswerInputRequest = () => {
    setRespondingToInputRequest(null);
  }

  const saveTag = async (tag: MetaTagResponseDto): Promise<boolean> => {
    if (!task) {
      return false;
    }
    try {
      await handlers.addTag({
        taskId: task.id,
        tag,
      });
      return true;
    } catch (err: unknown) {
      showError(err);
      return false;
    }
  }
  const cancelTag = () => {
    setShowTagPop(false);
  }

  const removeTag = async (tagId: string) => {
    if (!task) {
      return;
    }
    try {
      await handlers.removeTag({ taskId: task.id, tagId });
    } catch (err: unknown) {
      showError(err);
    }
  }

  const saveDependency = async (dependencyTask: Task): Promise<boolean> => {
    if (!task) {
      return false;
    }
    try {
      await handlers.addDependency({
        taskId: task.id,
        dependencyTaskId: dependencyTask.id,
      });
      return true;
    } catch (err: unknown) {
      showError(err);
      return false;
    }
  }

  const cancelDependency = () => {
    setShowDependencyPop(false);
  }

  const removeDependency = async (dependencyTaskId: string) => {
    if (!task) {
      return;
    }
    try {
      await handlers.removeDependency({ taskId: task.id, dependencyTaskId });
    } catch (err: unknown) {
      showError(err);
    }
  }

  const activity = task ? activityByTaskId[task.id] : null;

  useEffect(() => {
    setShowAllTimelineItems(false);
    setShowAllExecutions(false);
  }, [task?.id]);

  const loadExecutionsForTask = useCallback(async (taskId: string) => {
    setIsLoadingExecutions(true);
    try {
      const [activeResponse, historyResponse] = await Promise.all([
        ExecutionsService.ActiveTaskExecutionController_listActiveExecutions({ taskId, limit: 100 }),
        ExecutionsService.TaskExecutionHistoryController_listHistory({ taskId, limit: 100 }),
      ]);

      const taskActiveItems = activeResponse.items
        .map((entry: ActiveTaskExecutionResponseDto): TaskExecutionListItem => ({
          id: `active-${entry.id}`,
          executionId: entry.id,
          agentActorId: entry.agentActorId,
          status: 'ACTIVE',
          source: 'active',
          timestamp: entry.claimedAt,
          runnerSessionId: entry.runnerSessionId,
          toolCallCount: entry.toolCallCount,
          errorCode: null,
          errorMessage: null,
        }));

      const taskHistoryItems = historyResponse.items
        .map((entry: TaskExecutionHistoryResponseDto): TaskExecutionListItem => ({
          id: `history-${entry.id}`,
          executionId: entry.id,
          agentActorId: entry.agentActorId,
          status: entry.status,
          source: 'history',
          timestamp: entry.transitionedAt,
          runnerSessionId: entry.runnerSessionId,
          toolCallCount: entry.toolCallCount,
          errorCode: entry.errorCode,
          errorMessage: entry.errorMessage,
        }));

      const sorted = [...taskActiveItems, ...taskHistoryItems].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      setExecutions(sorted);
      setExecutionsError(null);
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : 'Failed to load runs for this task';
      setExecutionsError(message);
    } finally {
      setIsLoadingExecutions(false);
    }
  }, []);

  const timelineItems = useMemo(() => {
    if (!task) {
      return [];
    }

    type TimelineItem =
      | { type: 'comment'; data: Task['comments'][number]; timestamp: number }
      | { type: 'inputRequest'; data: InputRequestResponseDto; timestamp: number };

    return [
      ...task.comments.map((comment) => ({
        type: 'comment' as const,
        data: comment,
        timestamp: new Date(comment.createdAt).getTime(),
      })),
      ...task.inputRequests.map((inputRequest) => ({
        type: 'inputRequest' as const,
        data: inputRequest,
        timestamp: new Date(inputRequest.createdAt).getTime(),
      })),
    ]
      .sort((a, b) => a.timestamp - b.timestamp) as TimelineItem[];
  }, [task]);

  const visibleTimelineItems = showAllTimelineItems
    ? timelineItems
    : timelineItems.slice(0, COLLAPSED_TIMELINE_COUNT);
  const hasMoreTimelineItems = timelineItems.length > COLLAPSED_TIMELINE_COUNT;

  const visibleExecutions = showAllExecutions
    ? executions
    : executions.slice(0, COLLAPSED_EXECUTION_COUNT);
  const hasMoreExecutions = executions.length > COLLAPSED_EXECUTION_COUNT;

  useEffect(() => {
    if (!task) {
      setExecutions([]);
      setExecutionsError(null);
      setExpandedExecutionErrorIds(new Set());
      return;
    }

    setExpandedExecutionErrorIds(new Set());
    void loadExecutionsForTask(task.id);
  }, [task, loadExecutionsForTask]);

  useEffect(() => {
    if (!task || !activity) {
      return;
    }

    if (!activity.kind.startsWith('execution.')) {
      return;
    }

    void loadExecutionsForTask(task.id);
  }, [activity, task, loadExecutionsForTask]);

  useEffect(() => {
    if (!task || !activity || !activity.message) {
      return;
    }

    if (activityHideTimerRef.current) {
      window.clearTimeout(activityHideTimerRef.current);
    }
    if (activityExitTimerRef.current) {
      window.clearTimeout(activityExitTimerRef.current);
    }

    setLiveActivity(activity);
    setActivityPhase('enter');

    activityHideTimerRef.current = window.setTimeout(() => {
      setActivityPhase('exit');
      activityExitTimerRef.current = window.setTimeout(() => {
        setLiveActivity(null);
        setActivityPhase('idle');
      }, ACTIVITY_EXIT_MS);
    }, ACTIVITY_VISIBLE_MS);
  }, [activity, task, ACTIVITY_EXIT_MS, ACTIVITY_VISIBLE_MS]);

  if (!task && isLoadingTask) {
    return <TaskDetailLoadingShell backPath={backPath} />;
  }

  if (!task) {
    return (
      <div className="task-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Task not found</Text>
          <Button variant="secondary" onClick={() => navigate(backPath)}>
            Back to tasks
          </Button>
        </Stack>
      </div>
    );
  }

  const handleChangeStatus = async (newStatus: TaskStatus) => {
    setIsLoading(true);
    try {
      await handlers.changeStatus({ taskId: task.id, status: newStatus });
      setError(null);
    } catch (err: unknown) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="task-detail-page">

      {error && (
        <ErrorText>
          <button onClick={() => setError(null)} className="task-detail-page__error-close">×</button>
          {error}
        </ErrorText>
      )}

      <DataRowContainer className='task-detail-page__section'>
        <DataRow
          leading={<Avatar size={'sm'} name={task.createdByActor.displayName} src={task.createdByActor.avatarUrl || undefined} />}
          tags={[
            StatusTag({ status: task.status as TaskStatus }),
            ...task.tags.map(tag => ({
              label: tag.name,
              onRemove: () => removeTag(tag.id),
            })),
            {
              label: '+ add tag',
              color: 'gray' as const,
              onClick: () => setShowTagPop(true),
              clickLabel: 'Add tag',
            },
          ]}
          topRight={<Text size='1' tone='muted'>{elapsedTime(task.updatedAt)}</Text>}
        >
          <Text as='span' weight='medium' size='3'>
            {task.createdByActor.displayName}
          </Text>
          <Text as='span' weight='normal' tone='muted' size='3'>
            {` @${task.createdByActor.slug} created `}
          </Text>
          <Text as='span' tone='muted' style='mono'>
            #{task.id.slice(0, 6)}
          </Text>
          {!task.assigneeActor ? (
            <Text tone='muted'>
              unassigned
            </Text>
          ) : (
            null
          )}
        </DataRow>

        {task.assigneeActor ? (
          <DataRow
            leading={<Avatar size={'sm'} name={task.assigneeActor.displayName} src={task.assigneeActor.avatarUrl || undefined} />}
            onClick={() => setShowAssignPop(true)}
          >
            <Text as='span' weight='medium' size='3'>
              {task.assigneeActor.displayName}
            </Text>
            <Text as='span' weight='normal' tone='muted' size='3'>
              {` @${task.assigneeActor.slug} assigned`}
            </Text>
            <Text size='1' tone='muted'>tap to reassign</Text>
          </DataRow>
        ) : (
          null
        )}
      </DataRowContainer >

      {task.artefacts && task.artefacts.length > 0 && (
        <DataRowContainer className='task-detail-page__section'>
          {task.artefacts.map(artefact => (
            <DataRow
              key={artefact.id}

            >
              <Text as='span' weight='medium' size='3'>
                {`${artefact.name}: `}
              </Text>
              <Text as='span'>
                <a
                  href={artefact.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                >
                  {artefact.link}
                </a>
              </Text>
            </DataRow>
          ))}
        </DataRowContainer>
      )}

      {(dependencyTasks.length > 0 || task) && (
        <DataRowContainer title="Depends on" className='task-detail-page__section'>
          {dependencyTasks.map(depTask => {
            return (
              <TaskRow
                key={depTask.id}
                task={depTask}
                onClick={() => navigate(`/tasks/task/${depTask.id}`)}
                additionalTags={[
                  {
                    label: '× remove',
                    color: 'red' as const,
                    onClick: () => removeDependency(depTask.id),
                    clickLabel: 'Remove dependency',
                  },
                ]}
              />
            );
          })}
          <DataRow
            tags={[
              {
                label: '+ add dependency',
                color: 'gray' as const,
                onClick: () => setShowDependencyPop(true),
                clickLabel: 'Add dependency',
              },
            ]}
          >
            <Text tone='muted' size='2'>
              {dependencyTasks.length === 0 ? 'No dependencies yet' : 'Add another dependency'}
            </Text>
          </DataRow>
        </DataRowContainer>
      )}

      <DataRowContainer className='task-detail-page__section' >
        <DataRow
          leading={<Avatar size={'sm'} name={task.createdByActor.displayName} src={task.createdByActor.avatarUrl || undefined} />}
          tags={[]}
          topRight={<Text size='1' tone='muted'>{elapsedTime(task.createdAt)}</Text>}
        >
          <Text as='span' weight='medium' size='3'>
            {task.createdByActor.displayName}
          </Text>
          <Text as='span' weight='normal' tone='muted' size='3'>
            {` @${task.createdByActor.slug}`}
          </Text>
          <Text>
            {task.description ? (
              task.description
            ) : (
              'no description'
            )}
          </Text>
        </DataRow>
      </DataRowContainer >

      <DataRowContainer title="Updates" className='task-detail-page__section' >
        {timelineItems.length === 0 ? (
          <Text className="task-detail-page__executions-state" tone='muted'>No updates yet.</Text>
        ) : null}
        {visibleTimelineItems.map((item) => {
          if (item.type === 'comment') {
            const comment = item.data;
            const name = comment.commenterActor?.displayName || 'unknown';
            const slug = comment.commenterActor?.slug || 'unknown';
            return (
              <DataRow
                key={`comment-${comment.id}`}
                leading={<Avatar size={'sm'} name={name} src={comment.commenterActor?.avatarUrl || undefined} />}
                topRight={<Text size='1' tone='muted'>{elapsedTime(comment.createdAt)}</Text>}
              >
                <Text as='span' weight='medium' size='3'>
                  {name}
                </Text>
                <Text as='span' weight='normal' tone='muted' size='3'>
                  {` @${slug}`}
                </Text>
                <Text>
                  {comment.content}
                </Text>
              </DataRow>
            );
          }

          const inputRequest = item.data;
          const askedByActor = actors.find(a => a.id === inputRequest.askedByActorId);
          const assignedToActor = actors.find(a => a.id === inputRequest.assignedToActorId);
          const name = askedByActor?.displayName || 'Unknown';
          const slug = askedByActor?.slug || 'unknown';
          const answerName = assignedToActor?.displayName || 'Unknown';
          const answerSlug = assignedToActor?.slug || 'unknown';
          const isResolved = !!inputRequest.resolvedAt;
          const isAssignedToMe = user && inputRequest.assignedToActorId === user.actorId;
          const answerText = typeof inputRequest.answer === 'string'
            ? inputRequest.answer
            : JSON.stringify(inputRequest.answer);
          const tags = isResolved
            ? [
              { label: 'resolved question', color: 'gray' as const },
              { label: 'answer', color: 'green' as const },
            ]
            : [{ label: 'question', color: 'orange' as const }];

          return (
            <DataRow
              key={`input-request-${inputRequest.id}`}
              leading={isResolved ? (
                <div className="task-detail-page__input-request-avatars">
                  <Avatar size={'sm'} name={name} src={askedByActor?.avatarUrl || undefined} />
                  <Avatar size={'sm'} name={answerName} src={assignedToActor?.avatarUrl || undefined} />
                </div>
              ) : (
                <Avatar size={'sm'} name={name} src={askedByActor?.avatarUrl || undefined} />
              )}
              tags={tags}
              topRight={<Text size='1' tone='muted'>{elapsedTime(inputRequest.createdAt)}</Text>}
            >
              <Stack spacing="2">
                <div className="task-detail-page__input-request">
                  <div className="task-detail-page__input-request-question">
                    <div className="task-detail-page__input-request-header">
                      <Text as='span' weight='medium' size='3'>
                        {name}
                      </Text>
                      <Text as='span' weight='normal' tone='muted' size='3'>
                        {` @${slug}`}
                      </Text>
                    </div>
                    <Text>
                      <Text as='span' tone='muted'>Asked:</Text>{' '}
                      {inputRequest.question}
                    </Text>
                  </div>
                  {isResolved ? (
                    <div className="task-detail-page__input-request-answer">
                      <div className="task-detail-page__input-request-header">
                        <Text as='span' weight='medium' size='3'>
                          {answerName}
                        </Text>
                        <Text as='span' weight='normal' tone='muted' size='3'>
                          {` @${answerSlug}`}
                        </Text>
                      </div>
                      <Text>
                        <Text as='span' tone='muted'>Answered:</Text>{' '}
                        {answerText}
                      </Text>
                    </div>
                  ) : null}
                </div>
                {!isResolved && isAssignedToMe && (
                  <Button
                    size='sm'
                    variant='primary'
                    onClick={() => setRespondingToInputRequest(inputRequest)}
                  >
                    Respond
                  </Button>
                )}
              </Stack>
            </DataRow>
          );
        })}
        {hasMoreTimelineItems ? (
          <div className='task-detail-page__section-toggle'>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => setShowAllTimelineItems((prev) => !prev)}
            >
              {showAllTimelineItems
                ? 'Show fewer updates'
                : `See ${timelineItems.length - COLLAPSED_TIMELINE_COUNT} more updates`}
            </Button>
          </div>
        ) : null}
      </DataRowContainer>

      <DataRowContainer className='task-detail-page__section'>
        <div className="task-detail-page__activity">
          <div className={`task-detail-page__activity-slot ${liveActivity ? 'task-detail-page__activity-slot--active' : ''}`}>
            <div className="task-detail-page__activity-placeholder">
              <Text size='2' tone='muted'>Live activity will show here</Text>
            </div>
            {liveActivity ? (
              <div
                className={`task-detail-page__activity-card ${activityPhase === 'enter' ? 'is-entering' : ''} ${activityPhase === 'exit' ? 'is-exiting' : ''}`}
              >
                <Text size='2' className='task-detail-page__activity-message'>
                  {liveActivity.message?.replace(/\s+/g, ' ').trim() || 'Activity in progress...'}
                </Text>
              </div>
            ) : null}
          </div>
        </div>
      </DataRowContainer>

      <DataRowContainer title="Runs" className='task-detail-page__section'>
        {isLoadingExecutions && executions.length === 0 ? (
          <Text className="task-detail-page__executions-state" tone='muted'>Loading runs...</Text>
        ) : null}
        {executionsError ? (
          <Text className="task-detail-page__executions-state" tone='muted'>Failed to load runs: {executionsError}</Text>
        ) : null}
        {!isLoadingExecutions && !executionsError && executions.length === 0 ? (
          <Text className="task-detail-page__executions-state" tone='muted'>No runs yet for this task.</Text>
        ) : null}
        {visibleExecutions.map((execution) => {
          const actor = actors.find((candidate) => candidate.id === execution.agentActorId);
          const actorName = actor?.displayName ?? shortId(execution.agentActorId);
          const actorSlug = actor?.slug;
          const statusTag = getExecutionStatusTag(execution.status);
          const hasFailureDetails =
            execution.status === 'FAILED' && Boolean(execution.errorCode || execution.errorMessage);
          const isFailureDetailsExpanded = expandedExecutionErrorIds.has(execution.id);
          const isActive = execution.source === 'active';
          const isInterrupting = interruptingExecutions.has(execution.executionId);
          const sourceTag: DataRowTag = {
            label: isActive ? 'active' : 'history',
            color: 'gray',
          };

          return (
            <DataRow
              key={execution.id}
              leading={<Avatar size={'sm'} name={actorName} src={actor?.avatarUrl || undefined} />}
              tags={[statusTag, sourceTag]}
              topRight={
                isActive ? (
                  <Button
                    variant='danger'
                    size='sm'
                    disabled={isInterrupting}
                    onClick={() => void handleInterruptExecution(execution.executionId, task?.name, task?.id ?? '')}
                  >
                    {isInterrupting ? 'Interrupting…' : 'Interrupt'}
                  </Button>
                ) : (
                  <Text size='1' tone='muted'>{elapsedTime(execution.timestamp)}</Text>
                )
              }
            >
              <Stack spacing='1'>
                <div>
                  <Text as='span' weight='medium' size='3'>
                    {actorName}
                  </Text>
                  <Text as='span' weight='normal' tone='muted' size='3'>
                    {actorSlug ? ` @${actorSlug}` : ''}
                  </Text>
                </div>
                <Text as='span' tone='muted' size='2'>
                  <span className='task-detail-page__execution-meta'>
                    run #{shortId(execution.executionId)}
                    {hasFailureDetails ? (
                      <button
                        type='button'
                        className='task-detail-page__execution-error-toggle'
                        onClick={() => toggleExecutionErrorDetails(execution.id)}
                        aria-label={isFailureDetailsExpanded ? 'Hide failure details' : 'Show failure details'}
                        aria-expanded={isFailureDetailsExpanded}
                        title={isFailureDetailsExpanded ? 'Hide failure details' : 'Show failure details'}
                      >
                        i
                      </button>
                    ) : null}
                  </span>
                </Text>
                <Text as='span' size='1' tone='muted'>
                  <span className='task-detail-page__execution-stats'>
                    tools: {execution.toolCallCount}
                    <span className='task-detail-page__execution-stats-separator'>|</span>
                    session: {execution.runnerSessionId ? shortId(execution.runnerSessionId) : 'pending'}
                    {isActive ? (
                      <>
                        <span className='task-detail-page__execution-stats-separator'>|</span>
                        {elapsedTime(execution.timestamp)}
                      </>
                    ) : null}
                  </span>
                </Text>
                {hasFailureDetails && isFailureDetailsExpanded ? (
                  <div className='task-detail-page__execution-error-detail'>
                    {execution.errorCode ? (
                      <Text as='span' size='1' style='mono' className='task-detail-page__execution-error-code'>
                        {execution.errorCode}
                      </Text>
                    ) : null}
                    {execution.errorMessage ? (
                      <Text as='span' size='2' wrap>
                        {execution.errorMessage}
                      </Text>
                    ) : null}
                  </div>
                ) : null}
              </Stack>
            </DataRow>
          );
        })}
        {hasMoreExecutions ? (
          <div className='task-detail-page__section-toggle'>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => setShowAllExecutions((prev) => !prev)}
            >
              {showAllExecutions
                ? 'Show fewer runs'
                : `See ${executions.length - COLLAPSED_EXECUTION_COUNT} more runs`}
            </Button>
          </div>
        ) : null}
      </DataRowContainer>

      <DataRowContainer className='task-detail-page__status-buttons'>
        {Object.entries(TASKS_STATUS).map(([status, info]) => {
          const Icon = info.icon;
          return (
            <Button
              key={status}
              size='sm'
              variant={status === task.status ? 'primary' : 'secondary'}
              onClick={() => handleChangeStatus(status as TaskStatus)}
              disabled={isLoading}
            >
              <Stack spacing='1' align='center'>
                <Icon size={20} />
                <div>{info.label}</div>
              </Stack>
            </Button>
          );
        })}
      </DataRowContainer>

      <Button
        className="task-detail-fab"
        onClick={() => setShowNewCommentPop(true)}
        variant='primary'
        size='lg'
      >
        Add Comment
      </Button>

      {!task.assigneeActor && (
        <DataRowContainer className='task-detail-page__comment-buttons'>
          <Button
            size='lg'
            onClick={() => setShowAssignPop(true)}
          >
            Assign
          </Button>
          <Button
            size='lg'
            variant='primary'
            onClick={async () => {
              await handlers.assignTaskToMe({ taskId: task.id });
            }}
          >
            Assign to Me
          </Button>
        </DataRowContainer>
      )}

      <DeleteWithConfirmation
        className='task-detail-page__comment-buttons'
        onDelete={async () => {
          try {
            await handlers.deleteTask({ taskId: task.id });
            navigate(backPath);
          } catch (err: unknown) {
            showError(err);
          }
        }}
      />

      <DataRowContainer className='task-detail-page__actions'>
        {!isChatReadinessLoading && readiness && !readiness.isReady ? (
          <ChatSetupCallout
            title={readiness.title}
            description={readiness.description}
            ctaLabel={readiness.ctaLabel}
            onOpenSettings={() => navigate('/settings/chat')}
          />
        ) : null}

        <Button
          size='lg'
          variant={threadId ? 'primary' : 'secondary'}
          onClick={() => {
            void handleOpenOrCreateThread();
          }}
          disabled={isResolvingThread || !isChatReady || isChatReadinessLoading}
        >
          {threadId ? 'Go to thread' : 'Create thread'}
        </Button>
        <Button
          size='lg'
          variant='secondary'
          onClick={() => navigate(backPath)}
        >
          Back to Tasks
        </Button>
      </DataRowContainer>

      {showNewCommentPop ? <NewCommentPop onCancel={cancelNewComment} onSave={saveNewComment} taskId={task.id} /> : null}
      {showAssignPop ? <ActorSearchPop onCancel={cancelAssignment} onSave={saveAssignment} /> : null}
      {showTagPop ? <TagSearchPop onCancel={cancelTag} onSave={saveTag} existingTags={task.tags} /> : null}
      {showDependencyPop ? (
        <TaskSearchPop
          onCancel={cancelDependency}
          onSave={saveDependency}
          excludeTaskIds={[task.id, ...(task.dependsOnIds || [])]}
        />
      ) : null}
      {respondingToInputRequest ? (
        <AnswerInputRequestPop
          onCancel={cancelAnswerInputRequest}
          onSave={saveAnswerToInputRequest}
          taskId={task.id}
          inputRequestId={respondingToInputRequest.id}
          question={respondingToInputRequest.question}
        />
      ) : null}
    </div >
  );
}

export function TaskDetailPage() {
  const { d: taskId } = useParams<{ d: string }>();
  const {
    tasks,
    getTaskById,
    isLoading,
    hasLoadedOnce,
    setSectionTitle,
    addComment,
    deleteTask,
    assignTask,
    assignTaskToMe,
    answerInputRequest,
    activityByTaskId,
  } = useTasksCtx();

  const [isFetchingTask, setIsFetchingTask] = useState(false);

  // Derive task from the live tasks array so WebSocket updates are reflected automatically.
  const task = taskId ? tasks.find(t => t.id === taskId) : undefined;

  // On mount (or taskId change), ensure the task is in the cache.
  // getTaskById fetches from the API and adds it to the tasks array if missing.
  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;
    setIsFetchingTask(true);
    getTaskById(taskId)
      .catch((err) => console.error('Failed to fetch task', err))
      .finally(() => { if (!cancelled) setIsFetchingTask(false); });

    return () => { cancelled = true; };
  }, [taskId, getTaskById]);

  // Hydrate missing dependencies to ensure all dependency tasks are in the cache.
  // This prevents dependencies from being invisible (and therefore unremovable) when
  // they're outside the paginated allTasks cache (limited to 100 tasks).
  useEffect(() => {
    if (!task || !task.dependsOnIds || task.dependsOnIds.length === 0) return;

    const missingDependencyIds = task.dependsOnIds.filter(
      depId => !tasks.some(t => t.id === depId)
    );

    if (missingDependencyIds.length === 0) return;

    // Fetch all missing dependencies in parallel
    Promise.all(
      missingDependencyIds.map(depId =>
        getTaskById(depId).catch(err => {
          console.error(`Failed to hydrate dependency ${depId}`, err);
          return null;
        })
      )
    );
  }, [task, tasks, getTaskById]);

  const isLoadingTask = !task && (!hasLoadedOnce || isLoading || isFetchingTask);

  const handlers: TaskDetailHandlers = {
    addComment: ({ taskId, comment }) => addComment({ taskId, comment }),
    deleteTask: ({ taskId }) => deleteTask({ taskId }),
    assignTask: ({ taskId, assigneeActorId }) => assignTask({ taskId, assigneeActorId }),
    assignTaskToMe: ({ taskId }) => assignTaskToMe({ taskId }),
    answerInputRequest: ({ taskId, inputRequestId, answer }) => answerInputRequest({ taskId, inputRequestId, answer }),
    changeStatus: ({ taskId, status }) => TasksService.TasksController_changeStatus({ id: taskId, body: { status } }),
    addTag: ({ taskId, tag }) => TasksService.TasksController_addTagToTask({ id: taskId, body: { name: tag.name } }),
    removeTag: ({ taskId, tagId }) => TasksService.TasksController_removeTagFromTask({ id: taskId, tagId }),
    addDependency: async ({ taskId, dependencyTaskId }) => {
      const currentTask = tasks.find(t => t.id === taskId);
      if (!currentTask) return;
      const updatedDependsOnIds = [...(currentTask.dependsOnIds || []), dependencyTaskId];
      await TasksService.TasksController_updateTask({
        id: taskId,
        body: { dependsOnIds: updatedDependsOnIds },
      });
      // Best-effort: Fetch the dependency task to ensure it's in the cache for rendering.
      // This prevents the dependency from disappearing if it's not already in allTasks (paginated to 100).
      // If hydration fails, the mutation already succeeded, so we just log the error.
      try {
        await getTaskById(dependencyTaskId);
      } catch (err) {
        console.error(`Failed to hydrate dependency ${dependencyTaskId} after adding`, err);
      }
    },
    removeDependency: async ({ taskId, dependencyTaskId }) => {
      const currentTask = tasks.find(t => t.id === taskId);
      if (!currentTask) return;
      const updatedDependsOnIds = (currentTask.dependsOnIds || []).filter(id => id !== dependencyTaskId);
      await TasksService.TasksController_updateTask({
        id: taskId,
        body: { dependsOnIds: updatedDependsOnIds },
      });
    },
  };

  return (
    <TaskDetailView
      task={task}
      backPath="/tasks"
      setSectionTitle={setSectionTitle}
      isLoadingTask={isLoadingTask}
      activityByTaskId={activityByTaskId}
      handlers={handlers}
      allTasks={tasks}
    />
  );
}

function TaskDetailLoadingShell({ backPath }: { backPath: string }) {
  const navigate = useNavigate();

  return (
    <div className="task-detail-page">
      <DataRowContainer className="task-detail-page__section task-detail-page__shell-container">
        <div className="task-detail-page__shell-line task-detail-page__shell-line--wide" />
        <div className="task-detail-page__shell-line task-detail-page__shell-line--mid" />
      </DataRowContainer>

      <DataRowContainer className="task-detail-page__section task-detail-page__shell-container">
        <div className="task-detail-page__shell-line task-detail-page__shell-line--full" />
        <div className="task-detail-page__shell-line task-detail-page__shell-line--short" />
        <div className="task-detail-page__shell-line task-detail-page__shell-line--mid" />
      </DataRowContainer>

      <DataRowContainer className="task-detail-page__section task-detail-page__shell-container">
        <div className="task-detail-page__shell-line task-detail-page__shell-line--full" />
        <div className="task-detail-page__shell-line task-detail-page__shell-line--full" />
      </DataRowContainer>

      <div className="task-detail-page__actions">
        <Button size="lg" variant="secondary" onClick={() => navigate(backPath)}>
          Back to Tasks
        </Button>
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: TaskStatus }): DataRowTag {
  let color: DataRowTag['color'] = 'gray';
  let label = 'unknown';
  if (status === TaskStatus.DONE) {
    label = 'done';
    color = 'purple';
  } else if (status === TaskStatus.IN_PROGRESS) {
    label = 'in progress';
    color = 'green';
  } else if (status === TaskStatus.NOT_STARTED) {
    label = 'not started';
    color = 'blue';
  } else if (status === TaskStatus.FOR_REVIEW) {
    label = 'in review';
    color = 'orange';
  }
  return {
    label,
    color,
  }
}

function getExecutionStatusTag(
  status: 'ACTIVE' | TaskExecutionHistoryResponseDto['status'],
): DataRowTag {
  if (status === 'ACTIVE') {
    return { label: 'active', color: 'blue' };
  }

  if (status === 'SUCCEEDED') {
    return { label: 'succeeded', color: 'green' };
  }

  if (status === 'FAILED') {
    return { label: 'failed', color: 'red' };
  }

  if (status === 'STALE') {
    return { label: 'stale', color: 'orange' };
  }

  return { label: 'cancelled', color: 'gray' };
}

function shortId(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  return Boolean(target.closest('[contenteditable="true"], input, textarea, select'));
}
