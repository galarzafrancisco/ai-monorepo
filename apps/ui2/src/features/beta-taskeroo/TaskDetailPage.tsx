import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTaskerooCtx } from './taskeroo-context';
import { TaskerooService } from './api';
import { TaskStatus, TASKEROO_STATUS } from './const';
import type { Comment } from './types';
import {
  Text,
  Stack,
  Row,
  Button,
  Avatar,
  DataRow,
  Input,
  Textarea,
  ModalSheet
} from '../../ui/primitives';
import './TaskDetailPage.css';

type EditingField = 'title' | 'description' | 'assignee' | null;
type AssignPayload = Parameters<typeof TaskerooService.taskerooControllerAssignTask>[1];

const formatRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

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
  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState(false);

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
      const payload = {
        assignee: editValue.trim() || null,
      } as unknown as AssignPayload;
      await TaskerooService.taskerooControllerAssignTask(task.id, payload);
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
    if (task.status === newStatus) return;
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
      setIsCommentSheetOpen(false);
    } catch (err: unknown) {
      const errorMessage = (err as { body?: { detail?: string }; message?: string })?.body?.detail
        || (err as { message?: string })?.message
        || 'Failed to add comment';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCommentSheet = () => {
    setIsCommentSheetOpen(true);
  };

  const handleDismissCommentSheet = () => {
    if (isLoading) return;
    setIsCommentSheetOpen(false);
    setNewComment('');
  };

  const comments = (task.comments || []) as Comment[];
  const updatedTime = formatRelativeTime(task.updatedAt);
  const createdTime = new Date(task.createdAt).toLocaleString();

  return (
    <div className="task-detail-page">
      {/* Error banner */}
      {error && (
        <div className="task-detail-page__error" role="alert">
          <Text size="2" tone="default">{error}</Text>
          <button onClick={() => setError(null)} className="task-detail-page__error-close" aria-label="Dismiss error">&times;</button>
        </div>
      )}

      {/* Hero */}
      <section className="task-detail-page__hero task-detail-card">
        <Row spacing="3" align="center" className="task-detail-page__hero-top">
          <Avatar name={task.createdBy || 'Taskeroo'} size="lg" />
          <Stack spacing="1" className="task-detail-page__hero-meta">
            <Text size="1" tone="muted">{task.createdBy || 'Taskeroo'} / Taskeroo</Text>
            <Text size="2" tone="muted">Updated {updatedTime}</Text>
          </Stack>
          <span className="task-detail-page__status-pill" aria-label="Current status">
            {TASKEROO_STATUS[task.status].label}
          </span>
        </Row>

        <div className="task-detail-page__title-block">
          {editingField === 'title' ? (
            <Stack spacing="3">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="task-detail-page__title-input"
                autoFocus
                disabled={isLoading}
              />
              <Row spacing="2">
                <Button size="sm" onClick={handleSaveTitle} disabled={isLoading} type="button">
                  Save
                </Button>
                <Button size="sm" variant="secondary" onClick={handleCancelEdit} disabled={isLoading} type="button">
                  Cancel
                </Button>
              </Row>
            </Stack>
          ) : (
            <button
              type="button"
              className="task-detail-page__editable-block"
              onClick={() => handleStartEdit('title')}
            >
              <Text size="5" weight="bold" as="div" className="task-detail-page__title-text">
                {task.name}
              </Text>
              <span className="task-detail-page__edit-hint">Tap to edit title</span>
            </button>
          )}
        </div>

        <Row spacing="3" className="task-detail-page__hero-ids">
          <Text size="2" weight="medium">#{task.id.slice(0, 6)}</Text>
          {task.sessionId && (
            <Text size="2" tone="muted">Session {task.sessionId}</Text>
          )}
        </Row>
      </section>

      {/* Status */}
      <section className="task-detail-card">
        <div className="task-detail-card__header">
          <Text size="2" weight="semibold">Status</Text>
          <Text size="1" tone="muted">Move work between lanes</Text>
        </div>
        <div className="task-detail-page__status-grid">
          {Object.entries(TASKEROO_STATUS).map(([status, info]) => (
            <button
              type="button"
              key={status}
              className={`task-detail-page__status-btn ${task.status === status ? 'is-active' : ''}`}
              onClick={() => handleChangeStatus(status as TaskStatus)}
              disabled={isLoading}
            >
              <span className="task-detail-page__status-icon">{info.icon}</span>
              <span>{info.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Assignee */}
      <section className="task-detail-card">
        <div className="task-detail-card__header">
          <Text size="2" weight="semibold">Assignee</Text>
          <Text size="1" tone="muted">{task.assignee ? 'Owns this task' : 'No owner yet'}</Text>
        </div>
        {editingField === 'assignee' ? (
          <Stack spacing="3">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Enter assignee name"
              autoFocus
              disabled={isLoading}
            />
            <Row spacing="2">
              <Button size="sm" onClick={handleSaveAssignee} disabled={isLoading} type="button">
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit} disabled={isLoading} type="button">
                Cancel
              </Button>
            </Row>
          </Stack>
        ) : (
          <button
            type="button"
            className="task-detail-page__editable-block"
            onClick={() => handleStartEdit('assignee')}
          >
            {task.assignee ? (
              <Row spacing="3" align="center">
                <Avatar name={task.assignee} size="md" />
                <Stack spacing="1">
                  <Text size="3" weight="medium">{task.assignee}</Text>
                  <Text size="1" tone="muted">Tap to change</Text>
                </Stack>
              </Row>
            ) : (
              <Stack spacing="1">
                <Text size="3" tone="muted">Unassigned</Text>
                <Text size="1" tone="muted">Tap to assign an owner</Text>
              </Stack>
            )}
          </button>
        )}
      </section>

      {/* Description */}
      <section className="task-detail-card">
        <div className="task-detail-card__header">
          <Text size="2" weight="semibold">Description</Text>
          <Text size="1" tone="muted">Share extra context</Text>
        </div>
        {editingField === 'description' ? (
          <Stack spacing="3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={8}
              autoFocus
              disabled={isLoading}
              placeholder="Add a description..."
            />
            <Row spacing="2">
              <Button size="sm" onClick={handleSaveDescription} disabled={isLoading} type="button">
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit} disabled={isLoading} type="button">
                Cancel
              </Button>
            </Row>
          </Stack>
        ) : (
          <button
            type="button"
            className="task-detail-page__editable-block task-detail-page__description-block"
            onClick={() => handleStartEdit('description')}
          >
            {task.description ? (
              <p className="task-detail-page__description-text">
                {task.description}
              </p>
            ) : (
              <Text size="3" tone="muted">No description yet</Text>
            )}
            <span className="task-detail-page__edit-hint">Tap to edit description</span>
          </button>
        )}
      </section>

      {/* Tags */}
      <section className="task-detail-card">
        <div className="task-detail-card__header">
          <Text size="2" weight="semibold">Labels</Text>
          <Text size="1" tone="muted">Organize related work</Text>
        </div>
        <div className="task-detail-page__tags">
          {task.tags && task.tags.length > 0 ? (
            task.tags.map((tag) => (
              <span
                key={tag.name}
                className="task-detail-page__tag"
                style={{
                  backgroundColor: tag.color || 'var(--surface)',
                  color: tag.color ? 'var(--text-inverse)' : 'var(--text)',
                  borderColor: tag.color ? 'transparent' : 'var(--border-subtle)'
                }}
              >
                {tag.name}
              </span>
            ))
          ) : (
            <Text size="2" tone="muted">No labels added</Text>
          )}
        </div>
      </section>

      {/* Info */}
      <section className="task-detail-card">
        <div className="task-detail-card__header">
          <Text size="2" weight="semibold">Details</Text>
        </div>
        <div className="task-detail-page__info-grid">
          <div className="task-detail-page__info-item">
            <Text size="1" tone="muted">Created</Text>
            <Text size="2">{createdTime}</Text>
          </div>
          <div className="task-detail-page__info-item">
            <Text size="1" tone="muted">Created by</Text>
            <Text size="2">{task.createdBy || 'Unknown'}</Text>
          </div>
          {task.sessionId && (
            <div className="task-detail-page__info-item">
              <Text size="1" tone="muted">Session</Text>
              <Text size="2">{task.sessionId}</Text>
            </div>
          )}
        </div>
      </section>

      {/* Comments */}
      <section className="task-detail-card task-detail-card--list">
        <div className="task-detail-card__header">
          <Text size="2" weight="semibold">Activity</Text>
          <Row spacing="2" align="center">
            <span className="task-detail-page__comment-count">{comments.length}</span>
            <Button size="sm" variant="secondary" onClick={handleOpenCommentSheet} type="button">
              Comment
            </Button>
          </Row>
        </div>
        {comments.length > 0 ? (
          <div className="task-detail-page__comment-feed">
            {comments.map((comment) => (
              <DataRow
                key={comment.id}
                leading={<Avatar name={comment.commenterName} size="lg" />}
                topRight={<span className="task-detail-page__comment-date">{formatRelativeTime(comment.createdAt)}</span>}
                className="task-detail-page__comment-row"
              >
                <Stack spacing="2">
                  <Text size="2" weight="semibold">{comment.commenterName}</Text>
                  <Text size="2" as="div" className="task-detail-page__comment-body">{comment.content}</Text>
                </Stack>
              </DataRow>
            ))}
          </div>
        ) : (
          <div className="task-detail-page__comment-empty">
            <Text size="2" tone="muted">No comments yet. Start the conversation.</Text>
          </div>
        )}
      </section>

      <ModalSheet
        isOpen={isCommentSheetOpen}
        title="Add Comment"
        onClose={handleDismissCommentSheet}
        primaryAction={{
          label: isLoading ? 'Posting...' : 'Comment',
          onClick: handleAddComment,
          disabled: isLoading || !newComment.trim(),
        }}
        secondaryAction={{
          label: 'Cancel',
          onClick: handleDismissCommentSheet,
          disabled: isLoading,
        }}
      >
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Leave a comment..."
          rows={8}
          autoFocus
          disabled={isLoading}
        />
      </ModalSheet>
    </div>
  );
}
