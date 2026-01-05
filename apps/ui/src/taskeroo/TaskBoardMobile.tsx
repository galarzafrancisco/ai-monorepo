import { useMemo, useState } from 'react';
import { TaskDetail } from './TaskDetail';
import './TaskBoardMobile.css';
import { useTaskeroo } from './useTaskeroo';
import { Task, TaskStatus } from './types';
import { usePageTitle } from '../hooks/usePageTitle';
import { TagBadge } from './TagBadge';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { TaskerooService } from './api';
import { TagInput } from './TagInput';

type TaskStatusValue = typeof TaskStatus[keyof typeof TaskStatus];

const STATUS_ORDER: TaskStatusValue[] = [
  TaskStatus.NOT_STARTED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.FOR_REVIEW,
  TaskStatus.DONE,
];

const STATUS_META: Record<TaskStatusValue, { label: string; icon: string; sublabel: string }> = {
  [TaskStatus.NOT_STARTED]: {
    label: 'Queued',
    icon: '○',
    sublabel: 'Ideas + intake',
  },
  [TaskStatus.IN_PROGRESS]: {
    label: 'Building',
    icon: '▣',
    sublabel: 'Actively running',
  },
  [TaskStatus.FOR_REVIEW]: {
    label: 'Review',
    icon: '◆',
    sublabel: 'Needs eyeballs',
  },
  [TaskStatus.DONE]: {
    label: 'Shipped',
    icon: '▴',
    sublabel: 'Mission complete',
  },
};

export function TaskBoardMobile() {
  const { tasks, isConnected } = useTaskeroo();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeStatus, setActiveStatus] = useState<TaskStatusValue>(TaskStatus.NOT_STARTED);

  usePageTitle('Taskeroo');

  const tasksByStatus = useMemo(() => {
    return tasks.reduce<Record<TaskStatusValue, Task[]>>((acc, task) => {
      acc[task.status] = acc[task.status] ? [...acc[task.status], task] : [task];
      return acc;
    }, {
      [TaskStatus.NOT_STARTED]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.FOR_REVIEW]: [],
      [TaskStatus.DONE]: [],
    });
  }, [tasks]);

  const activeTasks = tasksByStatus[activeStatus] ?? [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.round((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${Math.max(diffInMinutes, 1)}m ago`;
    }

    const diffInHours = Math.round(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="task-board-mobile">
      <div className="matrix-frame">
        <header className="matrix-header">
          <HamburgerMenu />
          <div className="matrix-header-copy">
            <span className="matrix-pretitle">taskeroo ops terminal</span>
            <h1>Taskeroo</h1>
          </div>
          <div className="matrix-connection">
            <span className={`matrix-connection-dot ${isConnected ? 'online' : 'offline'}`} aria-hidden />
            <span>{isConnected ? 'socket live' : 'offline'}</span>
          </div>
        </header>

        <section className="matrix-status-panel">
          <div>
            <p className="matrix-status-label">Active lane</p>
            <h2>{STATUS_META[activeStatus].label}</h2>
            <p className="matrix-status-sub">{STATUS_META[activeStatus].sublabel}</p>
          </div>
          <div className="matrix-status-count">
            <span className="matrix-count-number">{activeTasks.length}</span>
            <span className="matrix-count-text">tasks</span>
          </div>
        </section>

        <section className="matrix-task-feed">
          {activeTasks.length === 0 && (
            <div className="matrix-empty-state">
              <p>No entries in this lane.</p>
              {activeStatus === TaskStatus.NOT_STARTED && (
                <button
                  type="button"
                  className="matrix-link"
                  onClick={() => setShowCreateForm(true)}
                >
                  create the first task
                </button>
              )}
            </div>
          )}

          {activeTasks.map((task) => (
            <article
              key={task.id}
              className="matrix-task-card"
              onClick={() => setSelectedTask(task)}
            >
              <div className="matrix-task-meta-row">
                <span className="matrix-task-id">#{task.id.slice(0, 6).toUpperCase()}</span>
                <span className="matrix-task-updated">{formatDate(task.updatedAt)}</span>
              </div>
              <h3>{task.name}</h3>
              <p>{task.description}</p>

              {task.tags && task.tags.length > 0 && (
                <div className="matrix-task-tags">
                  {task.tags.map((tag) => (
                    <TagBadge key={tag.name} tag={tag} small={true} />
                  ))}
                </div>
              )}

              <div className="matrix-task-footer">
                <span>
                  {task.assignee ? `Assigned: ${task.assignee}` : 'Unassigned'}
                </span>
                {task.comments && task.comments.length > 0 && (
                  <span>💬 {task.comments.length}</span>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>

      <nav className="matrix-bottom-nav" aria-label="Task status navigation">
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            className={`matrix-nav-item ${status === activeStatus ? 'active' : ''}`}
            onClick={() => setActiveStatus(status)}
            type="button"
          >
            <span className="matrix-nav-icon">{STATUS_META[status].icon}</span>
            <span className="matrix-nav-label">{STATUS_META[status].label}</span>
            <span className="matrix-nav-count">{tasksByStatus[status].length}</span>
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="matrix-fab"
        onClick={() => setShowCreateForm(true)}
        aria-label="Create task"
      >
        ➕
      </button>

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => setSelectedTask(updated)}
        />
      )}

      {showCreateForm && <MobileCreateTaskForm onClose={() => setShowCreateForm(false)} />}
    </div>
  );
}

interface MobileCreateTaskFormProps {
  onClose: () => void;
}

function MobileCreateTaskForm({ onClose }: MobileCreateTaskFormProps) {
  const { toasts, showToast, removeToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [dependsOn, setDependsOn] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim()) {
      showToast('Name and description are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const dependsOnIds = dependsOn
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      await TaskerooService.taskerooControllerCreateTask({
        name,
        description,
        ...(assignee && { assignee }),
        ...(sessionId && { sessionId }),
        ...(tagNames.length > 0 && { tagNames }),
        ...(dependsOnIds.length > 0 && { dependsOnIds }),
      });

      onClose();
    } catch (error: any) {
      const detail = error?.body?.detail || error?.message || 'Failed to create task';
      showToast(detail, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mobile-create-overlay" onClick={onClose}>
      <div className="mobile-create-panel" onClick={(e) => e.stopPropagation()}>
        <header className="mobile-create-header">
          <div>
            <p className="matrix-status-label">New task payload</p>
            <h2>Compose</h2>
          </div>
          <button type="button" className="matrix-link" onClick={onClose}>
            close
          </button>
        </header>

        <form className="mobile-create-form" onSubmit={handleSubmit}>
          <label>
            <span>Title *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ship a feature"
              required
            />
          </label>

          <label>
            <span>Description *</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline what needs to happen"
              rows={4}
              required
            />
          </label>

          <label>
            <span>Assignee</span>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="agent or human"
            />
          </label>

          <label>
            <span>Session ID</span>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="link a running session"
            />
          </label>

          <div className="mobile-form-control">
            <span>Tags</span>
            <TagInput value={tagNames} onChange={setTagNames} placeholder="ops, agents, ui" />
          </div>

          <label>
            <span>Depends on task IDs</span>
            <input
              type="text"
              value={dependsOn}
              onChange={(e) => setDependsOn(e.target.value)}
              placeholder="comma separated"
            />
          </label>

          <button type="submit" className="matrix-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Transmitting…' : 'Create Task'}
          </button>
        </form>

        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}
