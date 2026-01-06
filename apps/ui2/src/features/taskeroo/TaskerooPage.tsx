import { Stack, Text, ListRow, Card, Row } from '../../ui/primitives';

export type TaskStatus = 'not-started' | 'in_progress' | 'in_review' | 'done';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
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
    status: 'not-started',
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
    status: 'not-started',
    createdBy: 'Charlie',
    assignedTo: 'Bob',
    commentCount: 1,
  },
  {
    id: '6',
    title: 'Write API documentation',
    status: 'in_review',
    createdBy: 'Bob',
    assignedTo: 'Alice',
    commentCount: 4,
  },
  {
    id: '7',
    title: 'Set up CI/CD pipeline',
    status: 'in_review',
    createdBy: 'Alice',
    commentCount: 2,
  },
];

const STATUS_COLORS: Record<TaskStatus, string> = {
  'not-started': 'var(--text-muted)',
  'in_progress': 'var(--accent)',
  'in_review': 'var(--warning)',
  'done': 'var(--success)',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  'not-started': 'Not Started',
  'in_progress': 'In Progress',
  'in_review': 'In Review',
  'done': 'Done',
};

function StatusBadge({ status }: { status: TaskStatus }) {
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

function EmptyState({ status }: { status?: TaskStatus }) {
  const statusLabel = status ? STATUS_LABELS[status].toLowerCase() : '';
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

export interface TaskerooPageProps {
  status?: TaskStatus;
}

export function TaskerooPage({ status }: TaskerooPageProps) {
  const filteredTasks = status
    ? PLACEHOLDER_TASKS.filter((task) => task.status === status)
    : PLACEHOLDER_TASKS;

  const hasTasks = filteredTasks.length > 0;

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
