import { Stack, Text, Card } from '../../ui/primitives';
import type { Task } from './types';
import { STATUS_CONFIG } from './const';
import './BoardView.css';

interface TaskCardProps {
  task: Task;
}

function TaskCard({ task }: TaskCardProps) {
  const commentCount = task.comments?.length || 0;

  return (
    <Card padding="3" className="board-task-card">
      <Stack spacing="2">
        <Text size="1" tone="muted" weight="normal">#{task.id.slice(0, 6)}</Text>
        <Text weight="bold">{task.name}</Text>
        <Text size="2" wrap={true}>{task.description}</Text>
        <Stack spacing="1">
          <Text size="1" tone="muted">
            {task.createdBy}
          </Text>
          {task.assignee && (
            <Text size="1" tone="muted">
              Assigned: {task.assignee}
            </Text>
          )}
          {commentCount > 0 && (
            <Text size="1" tone="muted">
              💬 {commentCount}
            </Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

interface BoardColumnProps {
  status: Task.status;
  label: string;
  icon: string;
  tasks: Task[];
}

function BoardColumn({ status, label, icon, tasks }: BoardColumnProps) {
  return (
    <div className="board-column">
      <div className="board-column__header">
        <Text size="3" weight="bold">
          {icon} {label}
        </Text>
        <Text size="1" tone="muted">
          {tasks.length}
        </Text>
      </div>
      <div className="board-column__content">
        {tasks.length > 0 ? (
          <Stack spacing="3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </Stack>
        ) : (
          <div className="board-column__empty">
            <Text tone="muted" size="2">No tasks</Text>
          </div>
        )}
      </div>
    </div>
  );
}

interface BoardViewProps {
  tasks: Task[];
}

export function BoardView({ tasks }: BoardViewProps) {
  const tasksByStatus = STATUS_CONFIG.map(({ status, label, icon }) => {
    const filteredTasks = tasks.filter((task) => task.status === status);
    return {
      status,
      label,
      icon,
      tasks: filteredTasks,
    };
  });

  return (
    <div className="board-view">
      {tasksByStatus.map(({ status, label, icon, tasks }) => (
        <BoardColumn
          key={status}
          status={status}
          label={label}
          icon={icon}
          tasks={tasks}
        />
      ))}
    </div>
  );
}
