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
import { ActorSearchPop, Actor, useActorsCtx } from '../actors';
import { useAuth } from '../../auth/AuthContext';
import { InputRequestResponseDto } from "@taico/client/v2";
import { MetaTagResponseDto } from "@taico/client";
import { TaskActivityWireEvent } from '@taico/events';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { ThreadsService } from '../threads/api';
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

export function TaskDetailView({ task, backPath, setSectionTitle, isLoadingTask = false, activityByTaskId = {}, handlers, allTasks }: TaskDetailViewProps) {
  const navigate = useNavigate();
  const { actors } = useActorsCtx();
  const { user } = useAuth();
  const { showError, showToast } = useToast();
  const { registerCommands } = useCommandPalette();
  const { readiness, isReady: isChatReady, isLoading: isChatReadinessLoading } = useChatReadiness();

  const [liveActivity, setLiveActivity] = useState<TaskActivityWireEvent | null>(null);
  const [activityPhase, setActivityPhase] = useState<'idle' | 'enter' | 'exit'>('idle');
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

      const createdThread = await ThreadsService.createThread({
        title: task.name,
        parentTaskId: task.id,
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

    void ThreadsService.getThreadForTask(task.id)
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
  // If a dependency isn't in allTasks (e.g., outside the 100-task pagination window),
  // it simply won't display - which is acceptable behavior.
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

  const [showNewCommentPop, setShowNewCommentPop] = useState(false);
  const [showAssignPop, setShowAssignPop] = useState(false);
  const [showTagPop, setShowTagPop] = useState(false);
  const [respondingToInputRequest, setRespondingToInputRequest] = useState<InputRequestResponseDto | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!task || event.defaultPrevented) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (showNewCommentPop || showAssignPop || showTagPop || respondingToInputRequest) {
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
  }, [task, showNewCommentPop, showAssignPop, showTagPop, respondingToInputRequest]);

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

  const activity = task ? activityByTaskId[task.id] : null;

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

      {dependencyTasks.length > 0 && (
        <DataRowContainer title="Depends on" className='task-detail-page__section'>
          {dependencyTasks.map(depTask => {
            // Add synthetic status tag to display task status
            // Note: TaskRow component only uses tag.name, not tag.color
            const statusTag: MetaTagResponseDto = {
              id: `status-${depTask.status}`,
              name: TASKS_STATUS[depTask.status as TaskStatus].label,
              color: '', // Not used by TaskRow component
              createdAt: depTask.createdAt,
              updatedAt: depTask.updatedAt,
            };
            return (
              <TaskRow
                key={depTask.id}
                task={{
                  ...depTask,
                  tags: [...depTask.tags, statusTag],
                }}
                onClick={() => navigate(`/tasks/task/${depTask.id}`)}
              />
            );
          })}
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

      <DataRowContainer className='task-detail-page__section' >
        {
          (() => {
            type TimelineItem =
              | { type: 'comment'; data: typeof task.comments[0]; timestamp: number }
              | { type: 'inputRequest'; data: InputRequestResponseDto; timestamp: number };

            const timeline: TimelineItem[] = [
              ...task.comments.map(comment => ({
                type: 'comment' as const,
                data: comment,
                timestamp: new Date(comment.createdAt).getTime(),
              })),
              ...task.inputRequests.map(inputRequest => ({
                type: 'inputRequest' as const,
                data: inputRequest,
                timestamp: new Date(inputRequest.createdAt).getTime(),
              })),
            ].sort((a, b) => a.timestamp - b.timestamp);

            return timeline.map((item) => {
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
              } else if (item.type === 'inputRequest') {
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
              }
            });
          })()
        }
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

      <DataRowContainer className='task-detail-page__status-buttons'>
        {Object.entries(TASKS_STATUS).map(([status, info]) => (
          <Button
            key={status}
            size='sm'
            variant={status === task.status ? 'primary' : 'secondary'}
            onClick={() => handleChangeStatus(status as TaskStatus)}
            disabled={isLoading}
          >
            <Stack spacing='0'>
              <div>{info.icon}</div>
              <div>{info.label}</div>
            </Stack>
          </Button>
        ))}
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

  const task = tasks.find(t => t.id === taskId);
  const isLoadingTask = !task && (!hasLoadedOnce || isLoading);

  const handlers: TaskDetailHandlers = {
    addComment: ({ taskId, comment }) => addComment({ taskId, comment }),
    deleteTask: ({ taskId }) => deleteTask({ taskId }),
    assignTask: ({ taskId, assigneeActorId }) => assignTask({ taskId, assigneeActorId }),
    assignTaskToMe: ({ taskId }) => assignTaskToMe({ taskId }),
    answerInputRequest: ({ taskId, inputRequestId, answer }) => answerInputRequest({ taskId, inputRequestId, answer }),
    changeStatus: ({ taskId, status }) => TasksService.TasksController_changeStatus({ id: taskId, body: { status } }),
    addTag: ({ taskId, tag }) => TasksService.TasksController_addTagToTask({ id: taskId, body: { name: tag.name } }),
    removeTag: ({ taskId, tagId }) => TasksService.TasksController_removeTagFromTask({ id: taskId, tagId }),
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
