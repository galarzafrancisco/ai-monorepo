import { useState } from 'react';
import { Stack, Text, ListRow, Card } from '../../ui/primitives';
import type { Task } from './types';
import { STATUS_CONFIG } from './const';
import './ListView.css';

interface TaskRowProps {
  task: Task;
}

function TaskRow({ task }: TaskRowProps) {
  const commentCount = task.comments?.length || 0;

  return (
    <ListRow>
      <div style={{ flex: 1 }}>
        <Stack spacing="0">
          <Text tone="muted" weight="normal">#{task.id.slice(0, 6)}</Text>
          <Text weight="bold">{task.name}</Text>
          <Text weight="medium" wrap={true}>{task.description}</Text>
          <Text size="1" tone="muted">
            Created by {task.createdBy}
            {task.assignee && ` • Assigned to ${task.assignee}`}
            {commentCount ? ` • 💬 ${commentCount}` : ''}
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
            <Card padding="2">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </Card>
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
