import { useState, useEffect, useRef, useCallback } from 'react';
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
import { InputRequestResponseDto, MetaTagResponseDto } from "@taico/client";
import { TaskActivityWireEvent } from '@taico/events';
import { useDocumentTitle } from '../../shared/hooks/useDocumentTitle';
import { useToast } from '../../shared/context/ToastContext';
import { ThreadsService } from '../threads/api';
import type { Task } from './types';
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
  activityByTaskId?: Record<string, TaskActivityWireEvent>;
  handlers: TaskDetailHandlers;
};

export function TaskDetailView({ task, backPath, setSectionTitle, activityByTaskId = {}, handlers }: TaskDetailViewProps) {
  const navigate = useNavigate();
  const { actors } = useActorsCtx();
  const { user } = useAuth();
  const { showError } = useToast();
  const { registerCommands } = useCommandPalette();

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
  }, [task, threadId, navigate, showError]);

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

  useEffect(() => {
    if (!task) return;

    const statusAliases: Record<TaskStatus, string[]> = {
      [TaskStatus.NOT_STARTED]: ['not started', 'to do', 'todo', 'queued'],
      [TaskStatus.IN_PROGRESS]: ['in progress', 'doing', 'building'],
      [TaskStatus.FOR_REVIEW]: ['for review', 'review', 'in review'],
      [TaskStatus.DONE]: ['done', 'shipped', 'complete'],
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
    if (!task) {
      setSectionTitle('Task');
      return
    }
    setSectionTitle(task.name);
  }, [task, setSectionTitle]);

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
            StatusTag({ status: task.status }),
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
        <Button
          size='lg'
          variant={threadId ? 'primary' : 'secondary'}
          onClick={() => {
            void handleOpenOrCreateThread();
          }}
          disabled={isResolvingThread}
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
  const { tasks, setSectionTitle, addComment, deleteTask, assignTask, assignTaskToMe, answerInputRequest, activityByTaskId } = useTasksCtx();

  const task = tasks.find(t => t.id === taskId);

  const handlers: TaskDetailHandlers = {
    addComment: ({ taskId, comment }) => addComment({ taskId, comment }),
    deleteTask: ({ taskId }) => deleteTask({ taskId }),
    assignTask: ({ taskId, assigneeActorId }) => assignTask({ taskId, assigneeActorId }),
    assignTaskToMe: ({ taskId }) => assignTaskToMe({ taskId }),
    answerInputRequest: ({ taskId, inputRequestId, answer }) => answerInputRequest({ taskId, inputRequestId, answer }),
    changeStatus: ({ taskId, status }) => TasksService.tasksControllerChangeStatus(taskId, { status }),
    addTag: ({ taskId, tag }) => TasksService.tasksControllerAddTagToTask(taskId, { name: tag.name }),
    removeTag: ({ taskId, tagId }) => TasksService.tasksControllerRemoveTagFromTask(taskId, tagId),
  };

  return (
    <TaskDetailView
      task={task}
      backPath="/tasks"
      setSectionTitle={setSectionTitle}
      activityByTaskId={activityByTaskId}
      handlers={handlers}
    />
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
