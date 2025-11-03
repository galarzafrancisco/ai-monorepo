import { Task } from './types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="task-card" onClick={onClick}>
      <h3 className="task-card-title">{task.name}</h3>
      <p className="task-card-description">{task.description}</p>
      <div className="task-card-divider"></div>
      <div className="task-card-footer">
        <div className="task-card-assignee">
          {task.assignee ? (
            <>
              <span className="assignee-emoji">👤</span>
              <span className="assignee-name">{task.assignee}</span>
            </>
          ) : (
            <span className="unassigned-text">Unassigned</span>
          )}
        </div>
        <div className="task-card-date">
          {formatDate(task.updatedAt)}
        </div>
      </div>
    </div>
  );
}
