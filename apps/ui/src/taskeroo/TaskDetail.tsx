import { useState, useEffect } from 'react';
import { Task, TaskStatus } from './types';

const API_BASE = 'http://localhost:3000';


interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

export function TaskDetail({ task, onClose, onUpdate }: TaskDetailProps) {
  const [description, setDescription] = useState(task.description);
  const [assignee, setAssignee] = useState(task.assignee || '');
  const [sessionId, setSessionId] = useState(task.sessionId || '');
  const [comment, setComment] = useState('');
  const [commenterName, setCommenterName] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleUpdateDescription = async () => {
    if (description === task.description) return;

    try {
      const response = await fetch(`${API_BASE}/taskeroo/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      if (response.ok) {
        const updated = await response.json();
        onUpdate(updated);
        setErrorMessage('');
      } else {
        const error = await response.json();
        setErrorMessage(error.detail || 'Failed to update description');
      }
    } catch (err) {
      console.error('Failed to update task:', err);
      setErrorMessage('Failed to update description');
    }
  };

  const handleAssign = async () => {
    try {
      const body: any = {};
      // Allow empty assignee to unassign
      body.assignee = assignee.trim() || null;
      if (sessionId.trim()) body.sessionId = sessionId;

      const response = await fetch(`${API_BASE}/taskeroo/tasks/${task.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const updated = await response.json();
        onUpdate(updated);
        setErrorMessage('');
      } else {
        const error = await response.json();
        setErrorMessage(error.detail || 'Failed to update assignment');
      }
    } catch (err) {
      console.error('Failed to assign task:', err);
      setErrorMessage('Failed to update assignment');
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
        setErrorMessage('');
      } else {
        const error = await response.json();
        setErrorMessage(error.detail || 'Failed to add comment');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
      setErrorMessage('Failed to add comment');
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
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleUpdateDescription}
            placeholder="Enter task description..."
            className="description-textarea"
          />
        </div>

        <div className="detail-section">
          <h3>Status</h3>
          {errorMessage && (
            <div className="error-message">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}
          <div className="status-buttons">
            <button
              onClick={() => handleChangeStatus(TaskStatus.NOT_STARTED)}
              className={`status-btn ${task.status === 'not started' ? 'active status-not-started' : ''}`}
            >
              Not Started
            </button>
            <button
              onClick={() => handleChangeStatus(TaskStatus.IN_PROGRESS)}
              className={`status-btn ${task.status === 'in progress' ? 'active status-in-progress' : ''}`}
            >
              In Progress
            </button>
            <button
              onClick={() => handleChangeStatus(TaskStatus.FOR_REVIEW)}
              className={`status-btn ${task.status === 'for review' ? 'active status-for-review' : ''}`}
            >
              For Review
            </button>
            <button
              onClick={() => handleChangeStatus(TaskStatus.DONE)}
              className={`status-btn ${task.status === 'done' ? 'active status-done' : ''}`}
            >
              Done
            </button>
          </div>
        </div>

        <div className="detail-section">
          <h3>Assignee & Session</h3>
          <div className="assignee-form">
            <div className="form-row">
              <div className="form-field">
                <label>Assignee</label>
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Enter assignee name"
                />
              </div>
              <div className="form-field">
                <label>Session ID</label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Enter session ID"
                />
              </div>
            </div>
            <button onClick={handleAssign} className="btn-primary">
              Update Assignment
            </button>
          </div>
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
          {showDeleteConfirm ? (
            <div>
              <button onClick={handleDelete} className="btn-danger">
                Confirm Delete
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger">
              Delete Task
            </button>
          )}
        </div>


      </div>
    </div>
  );
}
