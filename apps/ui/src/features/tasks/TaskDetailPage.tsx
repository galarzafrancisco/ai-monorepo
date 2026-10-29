import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTasksCtx } from './TasksProvider';
import { TasksService } from './api';
import { TaskStatus, TASKS_STATUS } from './const';
import { Text, Stack, Button, Avatar, Chip, DataRow, ErrorText, DataRowContainer, useRailOpen } from '../../ui/primitives';
import { DeleteWithConfirmation, useCommandPalette } from '../../ui/components';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { NewCommentPop } from './NewCommentPop';
import { AnswerInputRequestPop } from './AnswerInputRequestPop';
import { TagSearchPop } from './TagSearchPop';
import { DependencyPicker } from './DependencyPicker';
import { applyProjectTagChange } from './projectPicker';
import { ProjectSelector } from './ProjectSelector';
import { ActorSearchPop, Actor, actorHandle, isDeactivated, useActorsCtx } from '../actors';
import { useAuth } from '../../auth/AuthContext';
import { InputRequestResponseDto } from "@taico/client/v2";
import { ExternalLink, GitBranch, Link2, MessagesSquare, X } from 'lucide-react';
import { MetaTagResponseDto } from "@taico/client";
import { TaskActivityWireEvent } from '@taico/events';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { ThreadsService } from '../threads/api';
import { ExecutionsService } from '../executions/api';
import type { Task } from './types';
import { useChatReadiness } from '../ai-models/useChatReadiness';
import { ChatSetupCallout } from '../ai-models/ChatSetupCallout';
import { TaskRunsPanel } from './traces/TaskRunsPanel';
import { RunList } from './traces/RunList';
import { loadTaskRuns, runTracePath, type TaskRun } from './traces/runs';
import { useProjects } from '../projects/useProjects';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { LinkifiedText, PullRequestChip, parsePullRequestUrl } from '../pull-requests';
import { IssueChip, parseIssueUrl } from '../issues';
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
  /** Scheduled-task blueprints have no status, so they hide the status controls. */
  canChangeStatus?: boolean;
};

/** Updates shown before "Show earlier updates": enough to see where the task stands. */
const RECENT_UPDATE_COUNT = 4;
const PROJECT_TAG_PREFIX = 'project:';
const RUNS_MODE_KEY = 'taico.taskRuns.mode';

export function TaskDetailView({ task, backPath, setSectionTitle, isLoadingTask = false, activityByTaskId = {}, handlers, allTasks, canChangeStatus = true }: TaskDetailViewProps) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { actors } = useActorsCtx();
  const { user } = useAuth();
  const { showError, showToast } = useToast();
  const { registerCommands } = useCommandPalette();
  const { readiness, isReady: isChatReady, isLoading: isChatReadinessLoading } = useChatReadiness();

  // The runs side bar is for troubleshooting: it starts collapsed, and stays open once you open it.
  // 'third' and 'full' are the panel's older open sizes.
  const [isRunsOpen, changeRunsOpen] = useRailOpen(RUNS_MODE_KEY, false, ['third', 'full']);
  const [executionsTaskId, setExecutionsTaskId] = useState<string | null>(null);
  const currentTaskId = useRef(task?.id);
  currentTaskId.current = task?.id;
  const [liveActivity, setLiveActivity] = useState<TaskActivityWireEvent | null>(null);
  const [activityPhase, setActivityPhase] = useState<'idle' | 'enter' | 'exit'>('idle');
  const [showAllTimelineItems, setShowAllTimelineItems] = useState(false);
  const { projects, isLoading: isLoadingProjects, error: projectsError } = useProjects();
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
      navigate('/settings/models');
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

    const statusCommands = !canChangeStatus ? [] : Object.entries(TASKS_STATUS).map(([status, info]) => ({
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
        id: 'task-set-project',
        label: 'Set project',
        description: 'Choose the project for this task',
        aliases: ['project', 'move project', 'p'],
        onSelect: () => setShowProjectPop(true),
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
  }, [task, canChangeStatus, registerCommands, handleChangeStatusForPalette, handlers, showError, threadId, handleOpenOrCreateThread]);

  useEffect(() => {
    if (isLoadingTask) {
      setSectionTitle('Loading task...');
      return;
    }
    if (!task) {
      setSectionTitle('Task');
      return
    }
    // On desktop the page shows its own title, so the runs panel can run the full height.
    setSectionTitle(isDesktop ? '' : task.name);
  }, [task, isLoadingTask, setSectionTitle, isDesktop]);

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
  const [executions, setExecutions] = useState<TaskRun[]>([]);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);
  const [executionsError, setExecutionsError] = useState<string | null>(null);
  const [interruptingExecutions, setInterruptingExecutions] = useState<Set<string>>(new Set());

  const [showNewCommentPop, setShowNewCommentPop] = useState(false);
  const [showAssignPop, setShowAssignPop] = useState(false);
  const [showTagPop, setShowTagPop] = useState(false);
  const [showDependencyPop, setShowDependencyPop] = useState(false);
  const [showProjectPop, setShowProjectPop] = useState(false);
  const [respondingToInputRequest, setRespondingToInputRequest] = useState<InputRequestResponseDto | null>(null);

  const handleInterruptExecution = useCallback(async (executionId: string, taskName: string | undefined) => {
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

      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
        return;
      }

      if (showNewCommentPop || showAssignPop || showTagPop || showDependencyPop || showProjectPop || respondingToInputRequest) {
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
      } else if (key === 'p') {
        event.preventDefault();
        setShowProjectPop(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task, showNewCommentPop, showAssignPop, showTagPop, showDependencyPop, showProjectPop, respondingToInputRequest]);

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
    setExecutions([]);
    setExecutionsTaskId(null);
    setExecutionsError(null);
  }, [task?.id]);

  const loadExecutionsForTask = useCallback(async (taskId: string) => {
    setIsLoadingExecutions(true);
    try {
      const sorted = await loadTaskRuns(taskId);
      if (currentTaskId.current !== taskId) return;
      setExecutionsTaskId(taskId);
      setExecutions(sorted);
      setExecutionsError(null);
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : 'Failed to load runs for this task';
      if (currentTaskId.current === taskId) setExecutionsError(message);
    } finally {
      if (currentTaskId.current === taskId) setIsLoadingExecutions(false);
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

  // The latest updates are what you open a task to read (did the reviewer run? what did it say?),
  // so they're always shown; older ones expand above them, keeping the order chronological.
  const hiddenTimelineCount = showAllTimelineItems ? 0 : Math.max(0, timelineItems.length - RECENT_UPDATE_COUNT);
  const visibleTimelineItems = timelineItems.slice(hiddenTimelineCount);

  useEffect(() => {
    if (!task) {
      setExecutions([]);
      setExecutionsError(null);
      return;
    }

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

  const projectTags = task.tags.filter((tag) => tag.name.startsWith(PROJECT_TAG_PREFIX));
  const otherTags = task.tags.filter((tag) => !tag.name.startsWith(PROJECT_TAG_PREFIX));
  const currentProject = projects.find((project) => projectTags.some((tag) => tag.id === project.tagId || tag.name === project.tagName)) ?? null;

  // A task's project is its project:<slug> tag. Picking a project swaps that tag.
  const changeProject = async (next: { tagName: string } | null): Promise<boolean> => {
    try {
      await applyProjectTagChange(
        projectTags,
        next,
        (tagName) => handlers.addTag({ taskId: task.id, tag: { name: tagName } as MetaTagResponseDto }),
        (tagId) => handlers.removeTag({ taskId: task.id, tagId }),
      );
      return true;
    } catch (err: unknown) {
      showError(err);
      return false;
    }
  };

  const runsPanel = (
    <TaskRunsPanel
      key={task.id}
      runs={executionsTaskId === task.id ? executions : []}
      isLoadingRuns={isLoadingExecutions}
      runsError={executionsError}
      onRefreshRuns={() => void loadExecutionsForTask(task.id)}
      open={isRunsOpen}
      onOpenChange={changeRunsOpen}
      onInterrupt={(run) => void handleInterruptExecution(run.executionId, task.name)}
      interruptingExecutionIds={interruptingExecutions}
    />
  );

  return (
    <div className="task-detail-workspace">
    <div className="task-detail-main">
    <div className="task-detail-page">

      {isDesktop && <h1 className="task-detail-page__title">{task.name}</h1>}

      {error && (
        <ErrorText>
          <button onClick={() => setError(null)} className="task-detail-page__error-close">×</button>
          {error}
        </ErrorText>
      )}

      {/* Everything you act on, at the top and always in reach: move the task, open its PR, talk about it. */}
      <div className="task-bar">
        <div className="task-bar__row">
          {canChangeStatus && <div className="task-bar__status" role="group" aria-label="Status">
            {Object.entries(TASKS_STATUS).map(([status, info]) => {
              const Icon = info.icon;
              const isCurrent = status === task.status;
              return (
                <button
                  key={status}
                  type="button"
                  className={`task-bar__status-option${isCurrent ? ' task-bar__status-option--current' : ''}`}
                  aria-pressed={isCurrent}
                  onClick={() => { if (!isCurrent) void handleChangeStatus(status as TaskStatus); }}
                  disabled={isLoading}
                >
                  <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                  {info.label}
                </button>
              );
            })}
          </div>}
          <div className="task-bar__actions">
            {task.artefacts.map((artefact) => {
              if (parsePullRequestUrl(artefact.link)) {
                return <PullRequestChip key={artefact.id} url={artefact.link} variant="full" />;
              }
              if (parseIssueUrl(artefact.link)) {
                return <IssueChip key={artefact.id} url={artefact.link} variant="full" />;
              }
              const { label } = describeArtefactLink(artefact.link);
              return (
                <a
                  key={artefact.id}
                  className="task-bar__link"
                  href={artefact.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${artefact.name}: ${artefact.link}`}
                >
                  <Link2 size={14} aria-hidden="true" />
                  <span className="task-bar__link-label">{label}</span>
                  <ExternalLink size={12} aria-hidden="true" className="task-bar__link-external" />
                </a>
              );
            })}
            <Button
              size="sm"
              variant="secondary"
              className="task-bar__thread"
              onClick={() => { void handleOpenOrCreateThread(); }}
              disabled={isResolvingThread || !isChatReady || isChatReadinessLoading}
              title={threadId ? 'Open this task’s thread' : 'Start a thread about this task'}
            >
              <MessagesSquare size={14} aria-hidden="true" />
              {threadId ? 'Thread' : 'New thread'}
            </Button>
          </div>
        </div>
        {liveActivity ? (
          <div
            className={`task-bar__activity ${activityPhase === 'enter' ? 'is-entering' : ''} ${activityPhase === 'exit' ? 'is-exiting' : ''}`}
            role="status"
          >
            <span className="task-bar__activity-dot" aria-hidden="true" />
            <span className="task-bar__activity-message">
              {liveActivity.message?.replace(/\s+/g, ' ').trim() || 'Activity in progress...'}
            </span>
          </div>
        ) : null}
      </div>

      <dl className="task-props">
        <dt>Assignee</dt>
        <dd>
          {task.assigneeActor ? (
            <button type="button" className="task-props__person" onClick={() => setShowAssignPop(true)} title="Reassign">
              <Avatar size="xs" name={task.assigneeActor.displayName} inactive={isDeactivated(task.assigneeActor)} src={task.assigneeActor.avatarUrl || undefined} />
              <span>{task.assigneeActor.displayName}</span>
              <span className="task-props__muted">{actorHandle(task.assigneeActor)}</span>
            </button>
          ) : (
            <span className="task-props__inline">
              <span className="task-props__muted">Unassigned</span>
              <Button size="sm" variant="secondary" onClick={() => setShowAssignPop(true)}>Assign</Button>
              <Button size="sm" variant="secondary" onClick={() => { handlers.assignTaskToMe({ taskId: task.id }).catch(showError); }}>Assign to me</Button>
            </span>
          )}
        </dd>

        <dt>Project</dt>
        <dd>
          <button
            type="button"
            className="task-props__person task-props__project"
            onClick={() => setShowProjectPop(true)}
            title="Change project (p)"
            aria-label={currentProject
              ? `Task project, ${currentProject.slug}`
              : projectTags[0]
                ? `Task project, ${projectTags[0].name.slice(PROJECT_TAG_PREFIX.length)}`
                : 'Task project, no project'}
          >
            {currentProject ? (
              <>
                <span className="task-props__swatch" style={currentProject.tagColor ? { background: currentProject.tagColor } : undefined} aria-hidden="true" />
                <span>{currentProject.slug}</span>
              </>
            ) : (
              <span className="task-props__muted">
                {projectTags[0] ? projectTags[0].name.slice(PROJECT_TAG_PREFIX.length) : 'No project'}
              </span>
            )}
          </button>
        </dd>

        <dt>Tags</dt>
        <dd className="task-props__tags">
          {otherTags.map((tag) => (
            <Chip key={tag.id} className="task-props__tag">
              {tag.name}
              <button type="button" className="chip__remove" onClick={() => void removeTag(tag.id)} aria-label={`Remove tag ${tag.name}`}>×</button>
            </Chip>
          ))}
          <Chip onClick={() => setShowTagPop(true)} clickLabel="Add tag">+ add tag</Chip>
        </dd>

        <dt>Depends on</dt>
        <dd className="task-props__deps">
          {(task.dependsOnIds ?? []).map((depId) => {
            const depTask = dependencyTasks.find((candidate) => candidate.id === depId);
            const depStatus = depTask ? TASKS_STATUS[depTask.status] : null;
            const DepIcon = depStatus?.icon;
            const depName = depTask?.name ?? `#${depId.slice(0, 6)}`;
            return (
              <span key={depId} className={`task-dep task-dep--${depTask?.status ?? 'loading'}`}>
                <Link className="task-dep__link" to={`/tasks/task/${depId}`} title={depStatus ? `${depName} · ${depStatus.label}` : depName}>
                  {DepIcon ? <DepIcon size={13} aria-label={depStatus.label} /> : null}
                  <span className="task-dep__name">{depName}</span>
                </Link>
                <button type="button" className="task-dep__remove" onClick={() => void removeDependency(depId)} aria-label={`Remove dependency ${depName}`} title="Remove dependency">
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            );
          })}
          <Chip onClick={() => setShowDependencyPop(true)} clickLabel="Add dependency">+ add</Chip>
          {(task.dependsOnIds ?? []).length > 0 && (
            <Link className="task-props__graph" to={`/tasks/dependencies/${task.id}`} title="View dependency graph">
              <GitBranch size={13} strokeWidth={1.75} aria-hidden="true" />
              graph
            </Link>
          )}
        </dd>

        <dt>Created</dt>
        <dd className="task-props__inline">
          <Avatar size="xs" name={task.createdByActor.displayName} inactive={isDeactivated(task.createdByActor)} src={task.createdByActor.avatarUrl || undefined} />
          <span>{task.createdByActor.displayName}</span>
          <span className="task-props__muted">{elapsedTime(task.createdAt)} · <span className="task-props__mono">#{task.id.slice(0, 6)}</span></span>
        </dd>
      </dl>

      <section className="task-detail-page__description" aria-label="Description">
        {task.description ? (
          <Text wrap><LinkifiedText text={task.description} /></Text>
        ) : (
          <Text tone="muted">No description</Text>
        )}
      </section>

      <DataRowContainer title="Updates" className='task-detail-page__section' >
        {timelineItems.length === 0 ? (
          <Text className="task-detail-page__executions-state" tone='muted'>No updates yet.</Text>
        ) : null}
        {hiddenTimelineCount > 0 || showAllTimelineItems ? (
          <div className='task-detail-page__section-toggle task-detail-page__section-toggle--top'>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => setShowAllTimelineItems((prev) => !prev)}
            >
              {showAllTimelineItems
                ? 'Show only recent updates'
                : `Show ${hiddenTimelineCount} earlier ${hiddenTimelineCount === 1 ? 'update' : 'updates'}`}
            </Button>
          </div>
        ) : null}
        {visibleTimelineItems.map((item) => {
          if (item.type === 'comment') {
            const comment = item.data;
            const name = comment.commenterActor?.displayName || 'unknown';
            const handle = comment.commenterActor ? actorHandle(comment.commenterActor) : '@unknown';
            return (
              <DataRow
                key={`comment-${comment.id}`}
                leading={<Avatar size={'sm'} name={name} inactive={isDeactivated(comment.commenterActor)} src={comment.commenterActor?.avatarUrl || undefined} />}
                topRight={<Text size='1' tone='muted'>{elapsedTime(comment.createdAt)}</Text>}
              >
                <Text as='span' weight='medium' size='3'>
                  {name}
                </Text>
                <Text as='span' weight='normal' tone='muted' size='3'>
                  {` ${handle}`}
                </Text>
                <Text wrap>
                  <LinkifiedText text={comment.content} />
                </Text>
              </DataRow>
            );
          }

          const inputRequest = item.data;
          const askedByActor = actors.find(a => a.id === inputRequest.askedByActorId);
          const assignedToActor = actors.find(a => a.id === inputRequest.assignedToActorId);
          const name = askedByActor?.displayName || 'Unknown';
          const handle = askedByActor ? actorHandle(askedByActor) : '@unknown';
          const answerName = assignedToActor?.displayName || 'Unknown';
          const answerHandle = assignedToActor ? actorHandle(assignedToActor) : '@unknown';
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
                  <Avatar size={'sm'} name={name} inactive={isDeactivated(askedByActor)} src={askedByActor?.avatarUrl || undefined} />
                  <Avatar size={'sm'} name={answerName} inactive={isDeactivated(assignedToActor)} src={assignedToActor?.avatarUrl || undefined} />
                </div>
              ) : (
                <Avatar size={'sm'} name={name} inactive={isDeactivated(askedByActor)} src={askedByActor?.avatarUrl || undefined} />
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
                        {` ${handle}`}
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
                          {` ${answerHandle}`}
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
      </DataRowContainer>

      {/* On desktop runs live in the side panel; on phones they're listed here and open their trace page. */}
      {!isDesktop ? (
        <DataRowContainer title="Runs" className='task-detail-page__section task-detail-page__runs'>
          <RunList
            runs={executionsTaskId === task.id ? executions : []}
            onSelect={(run) => navigate(runTracePath(run))}
            onInterrupt={(run) => void handleInterruptExecution(run.executionId, task.name)}
            interruptingExecutionIds={interruptingExecutions}
            isLoading={isLoadingExecutions}
            error={executionsError}
          />
        </DataRowContainer>
      ) : null}


      {!isChatReadinessLoading && readiness && !readiness.isReady ? (
        <DataRowContainer className='task-detail-page__actions'>
          <ChatSetupCallout
            title={readiness.title}
            description={readiness.description}
            ctaLabel={readiness.ctaLabel}
            onOpenSettings={() => navigate('/settings/models')}
          />
        </DataRowContainer>
      ) : null}

      <section className="task-danger-zone" aria-labelledby="task-danger-zone-title">
        <h2 id="task-danger-zone-title" className="task-danger-zone__title">Danger zone</h2>
        <div className="task-danger-zone__box">
          <div className="task-danger-zone__text">
            <Text weight="semibold">Delete this task</Text>
            <Text size="2" tone="muted">Once deleted, the task is gone for everyone. This can't be undone.</Text>
          </div>
          <DeleteWithConfirmation
            className="task-danger-zone__actions"
            size="sm"
            deleteLabel="Delete task"
            confirmLabel="Delete forever"
            onDelete={async () => {
              try {
                await handlers.deleteTask({ taskId: task.id });
                navigate(backPath);
              } catch (err: unknown) {
                showError(err);
              }
            }}
          />
        </div>
      </section>

      {showNewCommentPop ? <NewCommentPop onCancel={cancelNewComment} onSave={saveNewComment} taskId={task.id} /> : null}
      {showAssignPop ? <ActorSearchPop onCancel={cancelAssignment} onSave={saveAssignment} /> : null}
      {showTagPop ? <TagSearchPop onCancel={cancelTag} onSave={saveTag} existingTags={task.tags} /> : null}
      {showDependencyPop ? (
        <DependencyPicker task={task} onPick={saveDependency} onClose={cancelDependency} />
      ) : null}
      {showProjectPop ? (
        <ProjectSelector
          taskName={task.name}
          projects={projects}
          projectsState={isLoadingProjects ? 'loading' : projectsError ? 'error' : 'ready'}
          selectedProjectId={currentProject?.id ?? null}
          hasProjectTag={projectTags.length > 0}
          tasks={allTasks}
          onPick={changeProject}
          onClose={() => setShowProjectPop(false)}
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
      <Button
        className="task-detail-fab"
        onClick={() => setShowNewCommentPop(true)}
        variant='primary'
        size='lg'
      >
        Add Comment
      </Button>
    </div>
    {isDesktop ? runsPanel : null}
    </div>
  );
}

export function TaskDetailPage() {
  const { d: taskId } = useParams<{ d: string }>();
  const {
    tasks,
    detailTasks,
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

  const allCachedTasks = useMemo(() => {
    const taskById = new Map<string, Task>();
    for (const task of tasks) {
      taskById.set(task.id, task);
    }
    for (const task of detailTasks) {
      taskById.set(task.id, task);
    }
    return Array.from(taskById.values());
  }, [tasks, detailTasks]);

  // Derive task from all cached tasks so direct detail hydration does not affect board state.
  const task = taskId ? allCachedTasks.find(t => t.id === taskId) : undefined;

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
      depId => !allCachedTasks.some(t => t.id === depId)
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
  }, [task, allCachedTasks, getTaskById]);

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
      const currentTask = allCachedTasks.find(t => t.id === taskId);
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
      const currentTask = allCachedTasks.find(t => t.id === taskId);
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
      allTasks={allCachedTasks}
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

/** A link's short name: host and path. Pull request and issue links are drawn as chips instead. */
function describeArtefactLink(link: string): { label: string } {
  try {
    const url = new URL(link);
    const path = url.pathname.replace(/\/$/, '');
    return { label: `${url.hostname}${path.length > 24 ? `${path.slice(0, 24)}…` : path}` };
  } catch {
    return { label: link };
  }
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
