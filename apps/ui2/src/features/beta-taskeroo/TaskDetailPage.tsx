import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTaskerooCtx } from './TaskerooProvider';
import { TaskerooService } from './api';
import { TaskStatus, TASKEROO_STATUS } from './const';
import type { Comment } from './types';
import { Text, Stack, Row, Button, Divider, Avatar } from '../../ui/primitives';
import './TaskDetailPage.css';

type EditingField = 'title' | 'description' | 'assignee' | null;

export function TaskDetailPage() {
  const { d: taskId } = useParams<{ d: string }>();
  const navigate = useNavigate();
  const { tasks, setSectionTitle } = useTaskerooCtx();

  // Find task from context (real-time updates)
  const task = tasks.find(t => t.id === taskId);

  // Set section title for IosShell
  useEffect(() => {
    setSectionTitle(task ? `#${task.id.slice(0, 6)}` : 'Task');
  }, [task, setSectionTitle]);

  // Local state for editing
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState('');
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If task not found in context, could be loading or invalid
  if (!task) {
    return (
      <div className="task-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Task not found</Text>
          <Button variant="secondary" onClick={() => navigate('/taskeroo')}>
            Back to tasks
          </Button>
        </Stack>
      </div>
    );
  }

  const handleStartEdit = (field: EditingField) => {
    if (field === 'title') {
      setEditValue(task.name);
    } else if (field === 'description') {
      setEditValue(task.description || '');
    } else if (field === 'assignee') {
      setEditValue(task.assignee || '');
    }
    setEditingField(field);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setError(null);
  };

  const handleSaveTitle = async () => {
    if (!editValue.trim()) {
      setError('Title cannot be empty');
      return;
    }
    setIsLoading(true);
    try {
      await TaskerooService.taskerooControllerUpdateTask(task.id, { name: editValue.trim() });
      setEditingField(null);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = (err as { body?: { detail?: string }; message?: string })?.body?.detail
        || (err as { message?: string })?.message
        || 'Failed to update title';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDescription = async () => {
    setIsLoading(true);
    try {
      await TaskerooService.taskerooControllerUpdateTask(task.id, { description: editValue });
      setEditingField(null);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = (err as { body?: { detail?: string }; message?: string })?.body?.detail
        || (err as { message?: string })?.message
        || 'Failed to update description';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAssignee = async () => {
    setIsLoading(true);
    try {
      // Note: Using 'as any' to work around type mismatch in generated API client
      const body: { assignee: string | null; sessionId?: string } = {
        assignee: editValue.trim() || null
      };
      await TaskerooService.taskerooControllerAssignTask(task.id, body as any);
      setEditingField(null);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = (err as { body?: { detail?: string }; message?: string })?.body?.detail
        || (err as { message?: string })?.message
        || 'Failed to update assignee';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeStatus = async (newStatus: TaskStatus) => {
    setIsLoading(true);
    try {
      await TaskerooService.taskerooControllerChangeStatus(task.id, { status: newStatus });
      setError(null);
    } catch (err: unknown) {
      const errorMessage = (err as { body?: { detail?: string }; message?: string })?.body?.detail
        || (err as { message?: string })?.message
        || 'Failed to change status';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsLoading(true);
    try {
      await TaskerooService.taskerooControllerAddComment(task.id, { content: newComment.trim() });
      setNewComment('');
      setError(null);
    } catch (err: unknown) {
      const errorMessage = (err as { body?: { detail?: string }; message?: string })?.body?.detail
        || (err as { message?: string })?.message
        || 'Failed to add comment';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const comments = (task.comments || []) as Comment[];

  return (
    <div className="task-detail-page">
      {/* Error banner */}
      {error && (
        <div className="task-detail-page__error">
          <Text size="2" tone="default">{error}</Text>
          <button onClick={() => setError(null)} className="task-detail-page__error-close">×</button>
        </div>
      )}

      {/* Title Section */}
      <section className="task-detail-page__section">
        {editingField === 'title' ? (
          <Stack spacing="3">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="task-detail-page__input task-detail-page__input--title"
              autoFocus
              disabled={isLoading}
            />
            <Row spacing="2">
              <Button size="sm" onClick={handleSaveTitle} disabled={isLoading}>
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit} disabled={isLoading}>
                Cancel
              </Button>
            </Row>
          </Stack>
        ) : (
          <div className="task-detail-page__editable" onClick={() => handleStartEdit('title')}>
            <Text size="5" weight="bold" as="div" wrap>
              {task.name}
            </Text>
            <span className="task-detail-page__edit-hint">Tap to edit</span>
          </div>
        )}
      </section>

      <Divider spacing="3" />

      {/* Status & Metadata Section */}
      <section className="task-detail-page__section">
        <Text size="2" weight="semibold" tone="muted" as="div" className="task-detail-page__section-label">
          Status
        </Text>
        <div className="task-detail-page__status-buttons">
          {Object.entries(TASKEROO_STATUS).map(([status, info]) => (
            <button
              key={status}
              className={`task-detail-page__status-btn ${task.status === status ? 'task-detail-page__status-btn--active' : ''}`}
              onClick={() => handleChangeStatus(status as TaskStatus)}
              disabled={isLoading}
            >
              <span>{info.icon}</span>
              <span>{info.label}</span>
            </button>
          ))}
        </div>
      </section>

      <Divider spacing="3" />

      {/* Assignee Section */}
      <section className="task-detail-page__section">
        <Text size="2" weight="semibold" tone="muted" as="div" className="task-detail-page__section-label">
          Assignee
        </Text>
        {editingField === 'assignee' ? (
          <Stack spacing="3">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="task-detail-page__input"
              placeholder="Enter assignee name"
              autoFocus
              disabled={isLoading}
            />
            <Row spacing="2">
              <Button size="sm" onClick={handleSaveAssignee} disabled={isLoading}>
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit} disabled={isLoading}>
                Cancel
              </Button>
            </Row>
          </Stack>
        ) : (
          <div className="task-detail-page__editable" onClick={() => handleStartEdit('assignee')}>
            {task.assignee ? (
              <Row spacing="2">
                <Avatar name={task.assignee} size="sm" />
                <Text size="3">{task.assignee}</Text>
              </Row>
            ) : (
              <Text size="3" tone="muted">Unassigned</Text>
            )}
            <span className="task-detail-page__edit-hint">Tap to edit</span>
          </div>
        )}
      </section>

      <Divider spacing="3" />

      {/* Tags Section */}
      <section className="task-detail-page__section">
        <Text size="2" weight="semibold" tone="muted" as="div" className="task-detail-page__section-label">
          Tags
        </Text>
        <div className="task-detail-page__tags">
          {task.tags && task.tags.length > 0 ? (
            task.tags.map((tag) => (
              <span
                key={tag.name}
                className="task-detail-page__tag"
                style={{ backgroundColor: tag.color || '#6B7280' }}
              >
                {tag.name}
              </span>
            ))
          ) : (
            <Text size="2" tone="muted">No tags</Text>
          )}
        </div>
      </section>

      <Divider spacing="3" />

      {/* Description Section */}
      <section className="task-detail-page__section">
        <Text size="2" weight="semibold" tone="muted" as="div" className="task-detail-page__section-label">
          Description
        </Text>
        {editingField === 'description' ? (
          <Stack spacing="3">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="task-detail-page__textarea"
              rows={6}
              autoFocus
              disabled={isLoading}
              placeholder="Add a description..."
            />
            <Row spacing="2">
              <Button size="sm" onClick={handleSaveDescription} disabled={isLoading}>
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit} disabled={isLoading}>
                Cancel
              </Button>
            </Row>
          </Stack>
        ) : (
          <div className="task-detail-page__editable" onClick={() => handleStartEdit('description')}>
            {task.description ? (
              <Text size="3" as="div" wrap className="task-detail-page__description-text">
                {task.description}
              </Text>
            ) : (
              <Text size="3" tone="muted">No description</Text>
            )}
            <span className="task-detail-page__edit-hint">Tap to edit</span>
          </div>
        )}
      </section>

      <Divider spacing="3" />

      {/* Task Info Section */}
      <section className="task-detail-page__section">
        <Text size="2" weight="semibold" tone="muted" as="div" className="task-detail-page__section-label">
          Info
        </Text>
        <Stack spacing="2">
          <Row spacing="2">
            <Text size="2" tone="muted">Created by:</Text>
            <Text size="2">{task.createdBy || 'Unknown'}</Text>
          </Row>
          {task.sessionId && (
            <Row spacing="2">
              <Text size="2" tone="muted">Session:</Text>
              <Text size="2">{task.sessionId}</Text>
            </Row>
          )}
          <Row spacing="2">
            <Text size="2" tone="muted">Created:</Text>
            <Text size="2">{new Date(task.createdAt).toLocaleDateString()}</Text>
          </Row>
        </Stack>
      </section>

      <Divider spacing="3" />

      {/* Comments Section */}
      <section className="task-detail-page__section">
        <Text size="2" weight="semibold" tone="muted" as="div" className="task-detail-page__section-label">
          Comments ({comments.length})
        </Text>

        {/* Add comment */}
        <Stack spacing="3" className="task-detail-page__add-comment">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="task-detail-page__textarea task-detail-page__textarea--comment"
            rows={3}
            placeholder="Add a comment..."
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={handleAddComment}
            disabled={isLoading || !newComment.trim()}
          >
            Add Comment
          </Button>
        </Stack>

        {/* Comments list */}
        {comments.length > 0 && (
          <Stack spacing="3" className="task-detail-page__comments-list">
            {comments.map((comment) => (
              <div key={comment.id} className="task-detail-page__comment">
                <Row spacing="2" align="start">
                  <Avatar name={comment.commenterName} size="sm" />
                  <Stack spacing="1" className="task-detail-page__comment-content">
                    <Row spacing="2" align="center">
                      <Text size="2" weight="semibold">{comment.commenterName}</Text>
                      <Text size="1" tone="muted">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </Text>
                    </Row>
                    <Text size="2" as="div" wrap>{comment.content}</Text>
                  </Stack>
                </Row>
              </div>
            ))}
          </Stack>
        )}
      </section>
    </div>
  );
}
