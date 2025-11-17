import { Task } from './types';
import { TagBadge } from './TagBadge';

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

  const commentCount = task.comments?.length ?? 0;

  return (
    <div className="task-card" onClick={onClick}>
      <h3 className="task-card-title">{task.name}</h3>
      <p className="task-card-description">{task.description}</p>
      {task.tags && task.tags.length > 0 && (
        <div style={{ marginTop: '8px', marginBottom: '8px' }}>
          {task.tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} small={true} />
          ))}
        </div>
      )}
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
          {commentCount > 0 ? (
            <span className="comment-count" aria-label={`${commentCount} comments`}>
              💬 {commentCount}
            </span>
          ) : null}
        </div>
        <div className="task-card-date">
          {formatDate(task.updatedAt)}
        </div>
      </div>
    </div>
  );
}
