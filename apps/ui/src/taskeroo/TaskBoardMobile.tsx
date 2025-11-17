import { useState } from 'react';
import { TaskDetail } from './TaskDetail';
import { CreateTaskForm } from './CreateTaskForm';
import './TaskBoardMobile.css';
import { useTaskeroo } from './useTaskeroo';
import { Task, TaskStatus } from './types';
import { usePageTitle } from '../hooks/usePageTitle';
import { TagBadge } from './TagBadge';
import { HamburgerMenu } from '../components/HamburgerMenu';

export function TaskBoardMobile() {
  const { tasks, isConnected } = useTaskeroo();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<typeof TaskStatus[keyof typeof TaskStatus]>(TaskStatus.NOT_STARTED);

  usePageTitle('Taskeroo');

  const tasksByStatus: Record<string, Task[]> = {
    [TaskStatus.NOT_STARTED]: tasks.filter((t) => t.status === TaskStatus.NOT_STARTED),
    [TaskStatus.IN_PROGRESS]: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS),
    [TaskStatus.FOR_REVIEW]: tasks.filter((t) => t.status === TaskStatus.FOR_REVIEW),
    [TaskStatus.DONE]: tasks.filter((t) => t.status === TaskStatus.DONE),
  };

  const activeTasks = tasksByStatus[activeTab] || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTabLabel = (status: typeof TaskStatus[keyof typeof TaskStatus]) => {
    switch (status) {
      case TaskStatus.NOT_STARTED:
        return 'Not Started';
      case TaskStatus.IN_PROGRESS:
        return 'In Progress';
      case TaskStatus.FOR_REVIEW:
        return 'For Review';
      case TaskStatus.DONE:
        return 'Done';
      default:
        return status;
    }
  };

  return (
    <div className="task-board-mobile">
      {/* Header */}
      <div className="mobile-header">
        <div className="mobile-header-content">
          <HamburgerMenu />
          <h1>Taskeroo</h1>
          <span className={`mobile-status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="mobile-tabs">
        {Object.values(TaskStatus).map((status) => (
          <button
            key={status}
            className={`mobile-tab ${activeTab === status ? 'active' : ''}`}
            onClick={() => setActiveTab(status)}
          >
            {getTabLabel(status)}
            <span className="mobile-tab-count">{tasksByStatus[status].length}</span>
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="mobile-task-list">
        {activeTab === TaskStatus.NOT_STARTED && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="mobile-add-task-button"
          >
            + New Task
          </button>
        )}

        {activeTasks.map((task: Task) => (
          <div
            key={task.id}
            className="mobile-task-item"
            onClick={() => setSelectedTask(task)}
          >
            <div className="mobile-task-header">
              <h3 className="mobile-task-title">{task.name}</h3>
              <span className="mobile-task-time">{formatDate(task.updatedAt)}</span>
            </div>

            <p className="mobile-task-description">{task.description}</p>

            <div className="mobile-task-footer">
              {task.tags && task.tags.length > 0 && (
                <div className="mobile-task-tags">
                  {task.tags.map((tag: Task['tags'][0]) => (
                    <TagBadge key={tag.id} tag={tag} small={true} />
                  ))}
                </div>
              )}

              <div className="mobile-task-assignee">
                {task.assignee ? (
                  <>
                    <span className="mobile-assignee-emoji">👤</span>
                    <span className="mobile-assignee-name">{task.assignee}</span>
                  </>
                ) : (
                  <span className="mobile-unassigned">Unassigned</span>
                )}
                {task.comments && task.comments.length > 0 && (
                  <span className="mobile-comment-count">
                    💬 {task.comments.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {activeTasks.length === 0 && (
          <div className="mobile-empty-state">
            <p>No {getTabLabel(activeTab).toLowerCase()} tasks</p>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => setSelectedTask(updated)}
        />
      )}

      {/* Create Task Modal */}
      {showCreateForm && (
        <CreateTaskForm onClose={() => setShowCreateForm(false)} />
      )}
    </div>
  );
}
