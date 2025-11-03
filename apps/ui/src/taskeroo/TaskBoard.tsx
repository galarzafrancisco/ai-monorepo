import { useEffect, useState } from 'react';
import { useTaskerooSocket, Task } from './useTaskerooSocket';
import { TaskCard } from './TaskCard';
import { CreateTaskForm } from './CreateTaskForm';
import { TaskDetail } from './TaskDetail';
import './TaskBoard.css';

const API_BASE = 'http://localhost:3000';

export function TaskBoard() {
  const { tasks, setTasks, connected } = useTaskerooSocket();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch initial tasks
  useEffect(() => {
    fetch(`${API_BASE}/taskeroo/tasks`)
      .then((res) => res.json())
      .then((data) => setTasks(data))
      .catch((err) => console.error('Failed to fetch tasks:', err));
  }, [setTasks]);

  const tasksByStatus = {
    'not started': tasks.filter((t) => t.status === 'not started'),
    'in progress': tasks.filter((t) => t.status === 'in progress'),
    'for review': tasks.filter((t) => t.status === 'for review'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  return (
    <div className="task-board">
      <div className="task-board-header">
        <div>
          <h1>Taskeroo</h1>
          <p className="subtitle">Manage and track your tasks across different stages</p>
        </div>
        <div className="header-actions">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
      </div>

      <div className="kanban-board">
        {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
          <div key={status} className={`kanban-column column-${status.replace(' ', '-')}`}>
            <div className="column-header">
              <h2>{status.toUpperCase()}</h2>
              <span className="task-count">{statusTasks.length}</span>
            </div>
            <div className="column-content">
              {status === 'not started' && (
                <button onClick={() => setShowCreateForm(true)} className="btn-add-task">
                  + Add New Task
                </button>
              )}
              {statusTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => setSelectedTask(task)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreateForm && (
        <CreateTaskForm onClose={() => setShowCreateForm(false)} />
      )}

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => setSelectedTask(updated)}
        />
      )}
    </div>
  );
}
