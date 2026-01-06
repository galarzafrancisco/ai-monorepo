import { Stack, Text, ListRow, Card, Row } from '../../ui/primitives';

interface Task {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'done';
  assignedTo?: string;
  createdBy: string;
  commentCount: number;
}

// Placeholder data (no backend calls)
const PLACEHOLDER_TASKS: Task[] = [
  {
    id: '1',
    title: 'Implement user authentication',
    status: 'in_progress',
    createdBy: 'Alice',
    assignedTo: 'Bob',
    commentCount: 5,
  },
  {
    id: '2',
    title: 'Design new landing page',
    status: 'open',
    createdBy: 'Charlie',
    assignedTo: 'Alice',
    commentCount: 2,
  },
  {
    id: '3',
    title: 'Fix mobile responsive issues',
    status: 'done',
    createdBy: 'Bob',
    assignedTo: 'Charlie',
    commentCount: 8,
  },
  {
    id: '4',
    title: 'Add dark mode support',
    status: 'done',
    createdBy: 'Alice',
    commentCount: 3,
  },
  {
    id: '5',
    title: 'Optimize database queries',
    status: 'open',
    createdBy: 'Charlie',
    assignedTo: 'Bob',
    commentCount: 1,
  },
];

const STATUS_COLORS: Record<Task['status'], string> = {
  open: 'var(--text-muted)',
  in_progress: 'var(--accent)',
  done: 'var(--success)',
};

const STATUS_LABELS: Record<Task['status'], string> = {
  open: 'Open',
  in_progress: 'In Progress',
  done: 'Done',
};

function StatusBadge({ status }: { status: Task['status'] }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--r-2)',
        fontSize: 'var(--fs-1)',
        fontWeight: 'var(--fw-medium)',
        backgroundColor: 'var(--surface-2)',
        color: STATUS_COLORS[status],
        border: `1px solid ${STATUS_COLORS[status]}`,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <ListRow>
      <div style={{ flex: 1 }}>
        <Stack spacing="2">
          <Row spacing="3" align="center">
            <Text weight="medium">{task.title}</Text>
            <StatusBadge status={task.status} />
          </Row>
          <Text size="1" tone="muted">
            Created by {task.createdBy}
            {task.assignedTo && ` • Assigned to ${task.assignedTo}`}
            {` • ${task.commentCount} ${task.commentCount === 1 ? 'comment' : 'comments'}`}
          </Text>
        </Stack>
      </div>
    </ListRow>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 'var(--space-8)',
        textAlign: 'center',
      }}
    >
      <Stack spacing="3" align="center">
        <Text size="4" tone="muted">No tasks found</Text>
        <Text tone="muted">Create your first task to get started</Text>
      </Stack>
    </div>
  );
}

export function TaskerooPage() {
  const hasTasks = PLACEHOLDER_TASKS.length > 0;

  return (
    <Stack spacing="5">
      <Stack spacing="2">
        <Text size="6" weight="bold">Taskeroo</Text>
        <Text tone="muted">Manage your tasks and track progress</Text>
      </Stack>

      <Card padding="2">
        {hasTasks ? (
          PLACEHOLDER_TASKS.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))
        ) : (
          <EmptyState />
        )}
      </Card>
    </Stack>
  );
}
