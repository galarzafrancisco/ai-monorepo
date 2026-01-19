import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTaskerooCtx } from './TaskerooProvider';
import { TaskerooService } from './api';
import { TaskStatus, TASKEROO_STATUS } from './const';
import { Text, Stack, Button, Avatar, DataRow, ErrorText, DataRowTag, DataRowContainer } from '../../ui/primitives';
import { elapsedTime } from "../../shared/helpers/elapsedTime";
import { NewCommentPop } from './NewCommentPop';
import './TaskDetailPage.css';

export function TaskDetailPage() {
  const { d: taskId } = useParams<{ d: string }>();
  const navigate = useNavigate();
  const { tasks, setSectionTitle, addComment, deleteTask } = useTaskerooCtx();

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

  // Loading / error state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handlers for buttons
  const [showNewCommentPop, setShowNewCommentPop] = useState(false);

  const saveNewComment = async({content}: {content: string}): Promise<boolean> => {
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

  // If task not found in context, could be loading or invalid
  if (!task) {
    return (
      <div className="task-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Task not found</Text>
          <Button variant="secondary" onClick={() => navigate('/taskeroo')}>
            Back to tasks
          </Button>
        </Stack>
      </div>
    );
  }

  const handleChangeStatus = async (newStatus: TaskStatus) => {
    setIsLoading(true);
    try {
      await TaskerooService.taskerooControllerChangeStatus(task.id, { status: newStatus });
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
          leading={<Avatar size={'sm'} name={task.createdByActor.displayName} />}
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
            leading={<Avatar size={'sm'} name={task.assigneeActor.displayName} />}
          >
            <Text as='span' weight='medium' size='3'>
              {task.assigneeActor.displayName}
            </Text>
            <Text as='span' weight='normal' tone='muted' size='3'>
              {` @${task.assigneeActor.slug} assigned`}
            </Text>
          </DataRow>
        ) : (
          null
        )}
      </DataRowContainer >

      {/* Description */}
      <DataRowContainer className='task-detail-page__section' >
        <DataRow
          leading={<Avatar size={'sm'} name={task.createdByActor.displayName} />}
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
            )}s
          </Text>
        </DataRow>
      </DataRowContainer >

      {/* Comments */}
      <DataRowContainer className='task-detail-page__section' >
        {
          task.comments.map(comment => {
            const name = comment.commenterActor?.displayName || 'unknown';
            const slug = comment.commenterActor?.slug || 'unknown';
            return (
              <DataRow
                leading={<Avatar size={'sm'} name={name} />}
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
            )
          })
        }
      </DataRowContainer>

      {/* Status */}
      <DataRowContainer className='task-detail-page__status-buttons'>
        {Object.entries(TASKEROO_STATUS).map(([status, info]) => (
          <Button
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

      {/* Comment */}
      <DataRowContainer className='task-detail-page__comment-buttons'>
        <Button
          size='lg'
          onClick={() => setShowNewCommentPop(true)}
        >
          Comment
        </Button>
      </DataRowContainer>

      {/* Assign */}
      {!task.assigneeActor && (
        <DataRowContainer className='task-detail-page__comment-buttons'>
          <Button
            size='lg'
          >
            Assign
          </Button>
        </DataRowContainer>
      )}

      {/* Delete */}
      <DataRowContainer className='task-detail-page__comment-buttons'>
        <Button
          size='lg'
          variant='danger'
          onClick={async () => {
            await deleteTask({taskId: task.id});
            navigate('/taskeroo');
          }}
        >
          Delete
        </Button>
      </DataRowContainer>

      {/* Pops */}
      {showNewCommentPop ? <NewCommentPop onCancel={cancelNewComment} onSave={saveNewComment} /> : null}
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
