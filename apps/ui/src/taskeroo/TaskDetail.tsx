import { useState } from 'react';
import { Task } from './useTaskerooSocket';

const API_BASE = 'http://localhost:3000';

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

export function TaskDetail({ task, onClose, onUpdate }: TaskDetailProps) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(task.description);
  const [assignee, setAssignee] = useState(task.assignee || '');
  const [comment, setComment] = useState('');
  const [commenterName, setCommenterName] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleUpdateDescription = async () => {
    try {
      const response = await fetch(`${API_BASE}/taskeroo/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      if (response.ok) {
        const updated = await response.json();
        onUpdate(updated);
        setEditing(false);
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleAssign = async () => {
    if (!assignee.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/taskeroo/tasks/${task.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee }),
      });

      if (response.ok) {
        const updated = await response.json();
        onUpdate(updated);
      }
    } catch (err) {
      console.error('Failed to assign task:', err);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !commenterName.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/taskeroo/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commenterName, content: comment }),
      });

      if (response.ok) {
        // Refresh task to get updated comments
        const taskResponse = await fetch(`${API_BASE}/taskeroo/tasks/${task.id}`);
        const updated = await taskResponse.json();
        onUpdate(updated);
        setComment('');
        setCommenterName('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleChangeStatus = async (newStatus: Task['status']) => {
    try {
      const body: any = { status: newStatus };
      if (newStatus === 'done' && statusComment.trim()) {
        body.comment = statusComment;
      }

      const response = await fetch(`${API_BASE}/taskeroo/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const updated = await response.json();
        onUpdate(updated);
        setStatusComment('');
        setErrorMessage('');
      } else {
        const error = await response.json();
        setErrorMessage(error.detail || 'Failed to change status');
      }
    } catch (err) {
      console.error('Failed to change status:', err);
      setErrorMessage('Failed to change status');
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`${API_BASE}/taskeroo/tasks/${task.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content task-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task.name}</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>

        <div className="detail-section">
          <h3>Description</h3>
          {editing ? (
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
              <div className="form-actions">
                <button onClick={() => setEditing(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleUpdateDescription} className="btn-primary">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p>{task.description}</p>
              <button onClick={() => setEditing(true)} className="btn-secondary">
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="detail-section">
          <h3>Status: {task.status}</h3>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          <div className="status-actions">
            {task.status !== 'not started' && (
              <button onClick={() => handleChangeStatus('not started')} className="btn-status">
                Not Started
              </button>
            )}
            {task.status !== 'in progress' && (
              <button onClick={() => handleChangeStatus('in progress')} className="btn-status">
                In Progress
              </button>
            )}
            {task.status !== 'for review' && (
              <button onClick={() => handleChangeStatus('for review')} className="btn-status">
                For Review
              </button>
            )}
            {task.status !== 'done' && (
              <div>
                <input
                  type="text"
                  placeholder="Comment required for done"
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                />
                <button onClick={() => handleChangeStatus('done')} className="btn-status">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h3>Assignee</h3>
          <div className="assignee-section">
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Enter assignee name"
            />
            <button onClick={handleAssign} className="btn-primary">
              Assign
            </button>
          </div>
          {task.assignee && <p>Current: {task.assignee}</p>}
        </div>

        <div className="detail-section">
          <h3>Comments ({task.comments?.length || 0})</h3>
          <div className="comments-list">
            {task.comments?.map((c) => (
              <div key={c.id} className="comment">
                <strong>{c.commenterName}</strong>
                <p>{c.content}</p>
                <span className="comment-date">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="add-comment">
            <input
              type="text"
              placeholder="Your name"
              value={commenterName}
              onChange={(e) => setCommenterName(e.target.value)}
            />
            <textarea
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <button onClick={handleAddComment} className="btn-primary">
              Add Comment
            </button>
          </div>
        </div>

        <div className="detail-section">
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger">
            Delete Task
          </button>
        </div>

        {showDeleteConfirm && (
          <div className="confirm-dialog">
            <p>Are you sure you want to delete this task?</p>
            <div className="form-actions">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn-danger">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
