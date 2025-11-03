import { Task } from './useTaskerooSocket';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <div className="task-card" onClick={onClick}>
      <h3>{task.name}</h3>
      <p className="task-description">{task.description}</p>
      {task.assignee && (
        <div className="task-assignee">
          <span className="assignee-badge">{task.assignee}</span>
        </div>
      )}
      {task.comments.length > 0 && (
        <div className="task-meta">
          <span>💬 {task.comments.length}</span>
        </div>
      )}
    </div>
  );
}
