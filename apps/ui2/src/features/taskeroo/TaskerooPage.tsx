import { Stack, Text, ListRow, Card } from '../../ui/primitives';
import { useTaskerooCtx } from "./TaskerooProvider";
import type { Task } from './types';
import { TaskStatus } from './types';

const STATUS_LABELS: Record<Task.status, string> = {
  [TaskStatus.NOT_STARTED]: 'Not Started',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.FOR_REVIEW]: 'In Review',
  [TaskStatus.DONE]: 'Done',
};


function TaskRow({ task }: { task: Task }) {
  const commentCount = task.comments?.length || 0;

  return (
    <ListRow>
      <div style={{ flex: 1 }}>
        <Stack spacing='0'>
          <Text tone='muted' weight='normal'>#{task.id.slice(0,6)}</Text>
          <Text weight="bold">{task.name}</Text>
          <Text weight="medium" wrap={true}>{task.description}</Text>
          <Text size="1" tone="muted">
            Created by {task.createdBy}
            {task.assignee && ` • Assigned to ${task.assignee}`}
            {commentCount ? ` • 💬 ${commentCount}`: ''}
          </Text>
        </Stack>
      </div>
    </ListRow>
  );
}

function EmptyState({ status }: { status?: Task.status }) {
  const statusLabel = status ? STATUS_LABELS[status]?.toLowerCase() || status : '';
  return (
    <div
      style={{
        padding: 'var(--space-8)',
        textAlign: 'center',
      }}
    >
      <Stack spacing="3" align="center">
        <Text size="4" tone="muted">No {statusLabel} tasks</Text>
        <Text tone="muted">Tasks with this status will appear here</Text>
      </Stack>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        padding: 'var(--space-8)',
        textAlign: 'center',
      }}
    >
      <Text tone="muted">Loading tasks...</Text>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-8)',
        textAlign: 'center',
      }}
    >
      <Stack spacing="3" align="center">
        <Text size="4" tone="muted">Error loading tasks</Text>
        <Text tone="muted">{error}</Text>
      </Stack>
    </div>
  );
}

export interface TaskerooPageProps {
  status?: Task.status
}

export function TaskerooPage({ status }: TaskerooPageProps) {
  
  const { tasks, isLoading, error } = useTaskerooCtx();

  const filteredTasks = status
    ? tasks.filter((task) => task.status === status)
    : tasks;

  const hasTasks = filteredTasks.length > 0;

  if (isLoading && tasks.length === 0) {
    return (
      <Card padding="2">
        <LoadingState />
      </Card>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <Card padding="2">
        <ErrorState error={error} />
      </Card>
    );
  }

  return (
    <Card padding="2">
      {hasTasks ? (
        filteredTasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))
      ) : (
        <EmptyState status={status} />
      )}
    </Card>
  );
}
