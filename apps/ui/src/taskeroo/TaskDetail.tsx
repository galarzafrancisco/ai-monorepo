import { useState, useEffect } from 'react';
import { Task, TaskStatus, Comment } from './types';
import { TaskerooService } from './api';
import { TagInput } from './TagInput';


interface TaskDetailProps {
  task: Task;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

export function TaskDetail({ task, onClose, onUpdate }: TaskDetailProps) {
  const [description, setDescription] = useState(task.description);
  const [assignee, setAssignee] = useState(task.assignee || '');
  const [sessionId, setSessionId] = useState(task.sessionId || '');
  const [tagNames, setTagNames] = useState<string[]>(task.tags?.map(t => t.name) || []);
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
      const updated = await TaskerooService.taskerooControllerUpdateTask(
        task.id,
        { description }
      );
      onUpdate(updated);
      setErrorMessage('');
    } catch (err: any) {
      console.error('Failed to update task:', err);
      const errorMessage = err?.body?.detail || err?.message || 'Failed to update description';
      setErrorMessage(errorMessage);
    }
  };

  const handleAssign = async () => {
    try {
      const body: any = {};
      // Allow empty assignee to unassign
      body.assignee = assignee.trim() || null;
      if (sessionId.trim()) body.sessionId = sessionId;

      const updated = await TaskerooService.taskerooControllerAssignTask(
        task.id,
        body
      );
      onUpdate(updated);
      setErrorMessage('');
    } catch (err: any) {
      console.error('Failed to assign task:', err);
      const errorMessage = err?.body?.detail || err?.message || 'Failed to update assignment';
      setErrorMessage(errorMessage);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !commenterName.trim()) return;

    try {
      await TaskerooService.taskerooControllerAddComment(
        task.id,
        { commenterName, content: comment }
      );

      // Refresh task to get updated comments
      const updated = await TaskerooService.taskerooControllerGetTask(task.id);
      onUpdate(updated);
      setComment('');
      setCommenterName('');
      setErrorMessage('');
    } catch (err: any) {
      console.error('Failed to add comment:', err);
      const errorMessage = err?.body?.detail || err?.message || 'Failed to add comment';
      setErrorMessage(errorMessage);
    }
  };

  const handleChangeStatus = async (newStatus: Task['status']) => {
    try {
      const body: any = { status: newStatus };
      if (newStatus === TaskStatus.DONE && statusComment.trim()) {
        body.comment = statusComment;
      }

      const updated = await TaskerooService.taskerooControllerChangeStatus(
        task.id,
        body
      );
      onUpdate(updated);
      setStatusComment('');
      setErrorMessage('');
    } catch (err: any) {
      console.error('Failed to change status:', err);
      const errorMessage = err?.body?.detail || err?.message || 'Failed to change status';
      setErrorMessage(errorMessage);
    }
  };

  const handleDelete = async () => {
    try {
      await TaskerooService.taskerooControllerDeleteTask(task.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete task:', err);
      const errorMessage = (err as any)?.body?.detail || (err as any)?.message || 'Failed to delete task';
      setErrorMessage(errorMessage);
    }
  };

  const handleUpdateTags = async (newTagNames: string[]) => {
    setTagNames(newTagNames);
    try {
      const updated = await TaskerooService.taskerooControllerUpdateTask(task.id, {
        tagNames: newTagNames,
      });
      onUpdate(updated);
      setErrorMessage('');
    } catch (err: any) {
      console.error('Failed to update tags:', err);
      const errorMessage = err?.body?.detail || err?.message || 'Failed to update tags';
      setErrorMessage(errorMessage);
      // Revert on error
      setTagNames(task.tags?.map(t => t.name) || []);
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
              className={`status-btn ${task.status === TaskStatus.NOT_STARTED ? 'active status-not-started' : ''}`}
            >
              Not Started
            </button>
            <button
              onClick={() => handleChangeStatus(TaskStatus.IN_PROGRESS)}
              className={`status-btn ${task.status === TaskStatus.IN_PROGRESS ? 'active status-in-progress' : ''}`}
            >
              In Progress
            </button>
            <button
              onClick={() => handleChangeStatus(TaskStatus.FOR_REVIEW)}
              className={`status-btn ${task.status === TaskStatus.FOR_REVIEW ? 'active status-for-review' : ''}`}
            >
              For Review
            </button>
            <button
              onClick={() => handleChangeStatus(TaskStatus.DONE)}
              className={`status-btn ${task.status === TaskStatus.DONE ? 'active status-done' : ''}`}
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
          <h3>Tags</h3>
          <TagInput
            value={tagNames}
            onChange={handleUpdateTags}
            placeholder="Type to add tags..."
          />
        </div>

        <div className="detail-section">
          <h3>Comments ({task.comments?.length || 0})</h3>
          <div className="comments-list">
            {(task.comments as unknown as Comment[])?.map((c) => (
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
          <div className="task-actions">
            {task.status === TaskStatus.FOR_REVIEW && (
              <div className="review-shortcuts">
                <button
                  onClick={() => handleChangeStatus(TaskStatus.DONE)}
                  className="btn-review-done"
                >
                  ✓ Done
                </button>
                <button
                  onClick={() => handleChangeStatus(TaskStatus.IN_PROGRESS)}
                  className="btn-review-needs-work"
                >
                  ← Needs work
                </button>
              </div>
            )}
            {showDeleteConfirm ? (
              <div className="delete-confirm">
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
    </div>
  );
}
