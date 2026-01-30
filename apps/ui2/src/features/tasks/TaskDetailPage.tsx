import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTasksCtx } from './TasksProvider';
import { TasksService } from './api';
import { TaskStatus, TASKS_STATUS } from './const';
import { Text, Stack, Button, Avatar, DataRow, ErrorText, DataRowTag, DataRowContainer } from '../../ui/primitives';
import { DeleteWithConfirmation } from '../../ui/components';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { NewCommentPop } from './NewCommentPop';
import { AnswerInputRequestPop } from './AnswerInputRequestPop';
import { TagSearchPop } from './TagSearchPop';
import { ActorSearchPop, Actor, useActorsCtx } from '../actors';
import { useAuth } from '../../auth/AuthContext';
import { InputRequestResponseDto, MetaTagResponseDto } from 'shared';
import { TaskActivityItem } from './useTasks';
import './TaskDetailPage.css';

export function TaskDetailPage() {
  const { d: taskId } = useParams<{ d: string }>();
  const navigate = useNavigate();
  const { tasks, setSectionTitle, addComment, deleteTask, assignTask, assignTaskToMe, answerInputRequest, activityByTaskId } = useTasksCtx();
  const { actors } = useActorsCtx();
  const { user } = useAuth();

  const [liveActivity, setLiveActivity] = useState<TaskActivityItem | null>(null);
  const [activityPhase, setActivityPhase] = useState<'idle' | 'enter' | 'exit'>('idle');
  const activityHideTimerRef = useRef<number | null>(null);
  const activityExitTimerRef = useRef<number | null>(null);

  const ACTIVITY_VISIBLE_MS = 3500;
  const ACTIVITY_EXIT_MS = 220;

  // Find task from context (real-time updates)
  const task = tasks.find(t => t.id === taskId);

  // Set section title for IosShell
  useEffect(() => {
    // If title is short, use that
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

  // Loading / error state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handlers for buttons
  const [showNewCommentPop, setShowNewCommentPop] = useState(false);
  const [showAssignPop, setShowAssignPop] = useState(false);
  const [showTagPop, setShowTagPop] = useState(false);
  const [respondingToInputRequest, setRespondingToInputRequest] = useState<InputRequestResponseDto | null>(null);

  const saveNewComment = async ({ content }: { content: string }): Promise<boolean> => {
    if (!task) {
      return false;
    }
    try {
      await addComment({
        taskId: task.id,
        comment: content,
      });
      return true;
    } catch {
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
      await assignTask({
        taskId: task.id,
        assigneeActorId: actor.id,
      });
      return true;
    } catch {
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
      await answerInputRequest({
        taskId: task.id,
        inputRequestId: respondingToInputRequest.id,
        answer,
      });
      return true;
    } catch {
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
      await TasksService.tasksControllerAddTagToTask(task.id, {
        name: tag.name,
      });
      return true;
    } catch {
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
      await TasksService.tasksControllerRemoveTagFromTask(task.id, tagId);
    } catch (err: unknown) {
      const errorMessage = (err as { body?: { detail?: string }; message?: string })?.body?.detail
        || (err as { message?: string })?.message
        || 'Failed to remove tag';
      setError(errorMessage);
    }
  }

  const activity = task ? activityByTaskId[task.id] : null;

  useEffect(() => {
    if (!task || !activity) {
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

  // If task not found in context, could be loading or invalid
  if (!task) {
    return (
      <div className="task-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Task not found</Text>
          <Button variant="secondary" onClick={() => navigate('/tasks')}>
            Back to tasks
          </Button>
        </Stack>
      </div>
    );
  }

  const handleChangeStatus = async (newStatus: TaskStatus) => {
    setIsLoading(true);
    try {
      await TasksService.tasksControllerChangeStatus(task.id, { status: newStatus });
      setError(null);
    } catch (err: unknown) {
      const errorMessage = (err as { body?: { detail?: string }; message?: string })?.body?.detail
        || (err as { message?: string })?.message
        || 'Failed to change status';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="task-detail-page">

      {/* Error banner */}
      {error && (
        <ErrorText>
          <button onClick={() => setError(null)} className="task-detail-page__error-close">×</button>
          {error}
        </ErrorText>
      )}

      {/* Meta */}
      <DataRowContainer className='task-detail-page__section'>
        {/* Creator */}
        <DataRow
          leading={<Avatar size={'sm'} name={task.createdByActor.displayName} src={task.createdByActor.avatarUrl || undefined} />}
          tags={[
            StatusTag({ status: task.status }),
            ...task.tags.map(tag => ({ label: tag.name })),
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

        {/* Assignee */}
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

      {/* Tags */}
      <DataRowContainer className='task-detail-page__section'>
        <div className="task-detail-page__tags">
          <Text size='2' weight='medium'>Tags</Text>
          <div className="task-detail-page__tags-list">
            {task.tags.length === 0 ? (
              <Text size='2' tone='muted'>No tags</Text>
            ) : (
              task.tags.map(tag => (
                <button
                  key={tag.id}
                  className="task-detail-page__tag"
                  style={{ backgroundColor: tag.color || '#999' }}
                  onClick={() => removeTag(tag.id)}
                  title="Click to remove"
                >
                  {tag.name}
                  <span className="task-detail-page__tag-remove">×</span>
                </button>
              ))
            )}
            <Button
              size='sm'
              variant='secondary'
              onClick={() => setShowTagPop(true)}
            >
              + Add Tag
            </Button>
          </div>
        </div>
      </DataRowContainer>

      {/* Description */}
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

      {/* Comments and Input Requests Timeline */}
      <DataRowContainer className='task-detail-page__section' >
        {
          // Combine comments and input requests, sorted by timestamp
          (() => {
            type TimelineItem =
              | { type: 'comment'; data: typeof task.comments[0]; timestamp: number }
              | { type: 'inputRequest'; data: InputRequestResponseDto; timestamp: number }
              | { type: 'inputResponse'; data: InputRequestResponseDto; timestamp: number };

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
              ...task.inputRequests.filter(ir => ir.resolvedAt).map(inputRequest => ({
                type: 'inputResponse' as const,
                data: inputRequest,
                timestamp: new Date(inputRequest.updatedAt).getTime(),
              })),
            ].sort((a, b) => a.timestamp - b.timestamp);

            return timeline.map((item, index) => {
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
                const name = askedByActor?.displayName || 'Unknown';
                const slug = askedByActor?.slug || 'unknown';
                const isResolved = !!inputRequest.resolvedAt;
                const isAssignedToMe = user && inputRequest.assignedToActorId === user.actorId;

                return (
                  <DataRow
                    key={`input-request-${inputRequest.id}`}
                    leading={<Avatar size={'sm'} name={name} src={askedByActor?.avatarUrl || undefined} />}
                    tags={[{ label: isResolved ? 'resolved question' : 'question', color: isResolved ? 'gray' : 'orange' }]}
                    topRight={<Text size='1' tone='muted'>{elapsedTime(inputRequest.createdAt)}</Text>}
                  >
                    <Text as='span' weight='medium' size='3'>
                      {name}
                    </Text>
                    <Text as='span' weight='normal' tone='muted' size='3'>
                      {` @${slug}`}
                    </Text>
                    <Text>
                      {inputRequest.question}
                    </Text>
                    {!isResolved && isAssignedToMe && (
                      <Button
                        size='sm'
                        variant='primary'
                        onClick={() => setRespondingToInputRequest(inputRequest)}
                      >
                        Respond
                      </Button>
                    )}
                  </DataRow>
                );
              } else {
                // inputResponse
                const inputRequest = item.data;
                const assignedToActor = actors.find(a => a.id === inputRequest.assignedToActorId);
                const name = assignedToActor?.displayName || 'Unknown';
                const slug = assignedToActor?.slug || 'unknown';

                return (
                  <DataRow
                    key={`input-response-${inputRequest.id}`}
                    leading={<Avatar size={'sm'} name={name} src={assignedToActor?.avatarUrl || undefined} />}
                    tags={[{ label: 'answer', color: 'green' }]}
                    topRight={<Text size='1' tone='muted'>{elapsedTime(inputRequest.updatedAt)}</Text>}
                  >
                    <Text as='span' weight='medium' size='3'>
                      {name}
                    </Text>
                    <Text as='span' weight='normal' tone='muted' size='3'>
                      {` @${slug}`}
                    </Text>
                    <Text>
                      {typeof inputRequest.answer === 'string' ? inputRequest.answer : JSON.stringify(inputRequest.answer)}
                    </Text>
                  </DataRow>
                );
              }
            });
          })()
        }
      </DataRowContainer>

      {/* Live activity */}
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
                  {liveActivity.message.replace(/\s+/g, ' ').trim()}
                </Text>
              </div>
            ) : null}
          </div>
        </div>
      </DataRowContainer>

      {/* Status */}
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

      {/* Floating comment button */}
      <Button
        className="task-detail-fab"
        onClick={() => setShowNewCommentPop(true)}
        variant='primary'
        size='lg'
      >
        Add Comment
      </Button>

      {/* Assign */}
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
              await assignTaskToMe({ taskId: task.id });
            }}
          >
            Assign to Me
          </Button>
        </DataRowContainer>
      )}

      {/* Delete */}
      <DeleteWithConfirmation
        className='task-detail-page__comment-buttons'
        onDelete={async () => {
          await deleteTask({ taskId: task.id });
          navigate('/tasks');
        }}
      />

      {/* Back button */}
      <DataRowContainer className='task-detail-page__actions'>
        <Button
          size='lg'
          variant='secondary'
          onClick={() => navigate('/tasks')}
        >
          Back to Tasks
        </Button>
      </DataRowContainer>

      {/* Pops */}
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
