import { Stack, Text, ListRow, Card, Row } from '../../ui/primitives';
import { useTaskeroo } from './useTaskeroo';
import type { Task } from './types';

export type TaskStatus = 'not-started' | 'in_progress' | 'in_review' | 'done' | 'needs_work';

const STATUS_COLORS: Record<string, string> = {
  'not_started': 'var(--text-muted)',
  'in_progress': 'var(--accent)',
  'in_review': 'var(--warning)',
  'done': 'var(--success)',
  'needs_work': 'var(--danger)',
};

const STATUS_LABELS: Record<string, string> = {
  'not_started': 'Not Started',
  'in_progress': 'In Progress',
  'in_review': 'In Review',
  'done': 'Done',
  'needs_work': 'Needs Work',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--r-2)',
        fontSize: 'var(--fs-1)',
        fontWeight: 'var(--fw-medium)',
        backgroundColor: 'var(--surface-2)',
        color: STATUS_COLORS[status] || 'var(--text)',
        border: `1px solid ${STATUS_COLORS[status] || 'var(--border)'}`,
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function TaskRow({ task }: { task: Task }) {
  const commentCount = task.comments?.length || 0;

  return (
    <ListRow>
      <div style={{ flex: 1 }}>
        <Stack spacing="2">
          <Row spacing="3" align="center">
            <Text weight="medium">{task.description}</Text>
            <StatusBadge status={task.status} />
          </Row>
          <Text size="1" tone="muted">
            Created by {task.createdBy}
            {task.assignee && ` • Assigned to ${task.assignee}`}
            {` • ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`}
          </Text>
        </Stack>
      </div>
    </ListRow>
  );
}

function EmptyState({ status }: { status?: string }) {
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
  status?: string;
}

export function TaskerooPage({ status }: TaskerooPageProps) {
  const { tasks, isLoading, error } = useTaskeroo();

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
