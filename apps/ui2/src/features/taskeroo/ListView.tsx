import { useState } from 'react';
import { Stack, Text, ListRow, Card } from '../../ui/primitives';
import type { Task } from './types';
import { STATUS_CONFIG } from './const';
import './ListView.css';

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface TaskRowProps {
  task: Task;
}

function TaskRow({ task }: TaskRowProps) {
  const commentCount = task.comments?.length || 0;

  return (
    <ListRow>
      <div style={{ flex: 1 }}>
        <Stack spacing="1">
          {/* Header row: ID and timestamp */}
          <div className="task-row__header">
            <Text tone="muted" size="1">#{task.id.slice(0, 6)}</Text>
            <Text tone="muted" size="1">{formatRelativeTime(task.updatedAt)}</Text>
          </div>

          {/* Task name */}
          <Text weight="bold" size="3">{task.name}</Text>

          {/* Description - single line with ellipsis */}
          <div className="task-row__description">
            <Text size="2">{task.description}</Text>
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="task-row__tags">
              {task.tags.map((tag) => (
                <span key={tag.name} className="task-row__tag" style={{ backgroundColor: tag.color || '#e0e0e0' }}>
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Assignee info */}
          <Text size="1" tone="muted">
            {task.assignee ? `ASSIGNED: ${task.assignee.toUpperCase()}` : 'UNASSIGNED'}
            {commentCount > 0 && ` • 💬 ${commentCount}`}
          </Text>
        </Stack>
      </div>
    </ListRow>
  );
}

interface TaskGroupProps {
  status: Task.status;
  label: string;
  icon: string;
  tasks: Task[];
  isExpanded: boolean;
  onToggle: () => void;
}

function TaskGroup({ status, label, icon, tasks, isExpanded, onToggle }: TaskGroupProps) {
  return (
    <div className="task-group">
      <button
        className="task-group__header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="task-group__header-content">
          <Text size="4" weight="bold">
            {icon} {label}
          </Text>
          <Text size="2" tone="muted">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </Text>
        </div>
        <div className={`task-group__chevron ${isExpanded ? 'expanded' : ''}`}>
          ▼
        </div>
      </button>

      {isExpanded && (
        <div className="task-group__content">
          {tasks.length > 0 ? (
            <>
            {/* <Card padding="2"> */}
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            {/* </Card> */}
            </>
          ) : (
            <div className="task-group__empty">
              <Text tone="muted">No tasks in this group</Text>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ListViewProps {
  tasks: Task[];
}

export function ListView({ tasks }: ListViewProps) {
  // All groups expanded by default
  const [expandedGroups, setExpandedGroups] = useState<Set<Task.status>>(
    new Set(STATUS_CONFIG.map(({ status }) => status))
  );

  const toggleGroup = (status: Task.status) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const tasksByStatus = STATUS_CONFIG.map(({ status, label, icon }) => {
    const filteredTasks = tasks.filter((task) => task.status === status);
    return {
      status,
      label,
      icon,
      tasks: filteredTasks,
      isExpanded: expandedGroups.has(status),
    };
  });

  return (
    <div className="list-view">
      <Stack spacing="4">
        {tasksByStatus.map(({ status, label, icon, tasks, isExpanded }) => (
          <TaskGroup
            key={status}
            status={status}
            label={label}
            icon={icon}
            tasks={tasks}
            isExpanded={isExpanded}
            onToggle={() => toggleGroup(status)}
          />
        ))}
      </Stack>
    </div>
  );
}
