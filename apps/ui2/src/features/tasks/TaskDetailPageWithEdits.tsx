import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTasksCtx } from './TasksProvider';
import { ActorsService, TasksService } from './api';
import { TaskStatus, TASKS_STATUS } from './const';
import type { Comment } from './types';
import { Chip, Text, Stack, Row, Button, Divider, Avatar, ErrorText, type ChipProps, DataRow, DataRowContainer } from '../../ui/primitives';
import './TaskDetailPage.css';
import { ActorResponseDto } from 'shared';
import { DataRowTag } from 'src/ui/primitives/DataRow';
import { elapsedTime } from "../../shared/helpers/elapsedTime";

type EditingField = 'title' | 'description' | 'assignee' | null;

export function TaskDetailPage() {
  const { d: taskId } = useParams<{ d: string }>();
  const navigate = useNavigate();
  const { tasks, setSectionTitle } = useTasksCtx();

  // Find task from context (real-time updates)
  const task = tasks.find(t => t.id === taskId);

  // Set section title for IosShell
  useEffect(() => {
    // If title is short, use that
    if (!task) {
      setSectionTitle('Task');
      return
    }
    setSectionTitle(task.name);
  }, [task, setSectionTitle]);

  // Local state for editing
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState('');
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [actors, setActors] = useState<ActorResponseDto[]>([]);
  const [filteredActors, setFilteredActors] = useState<ActorResponseDto[]>([]);
  const [editAssignee, setEditAssignee] = useState('');
  const [selectedActor, setSelectedActor] = useState<ActorResponseDto | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchActors = async () => {
    const fetchedActors = await ActorsService.actorControllerListActors();
    setActors(fetchedActors);
    return fetchedActors;
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If task not found in context, could be loading or invalid
  if (!task) {
    return (
      <div className="task-detail-page">
        <Stack spacing="4" align="center">
          <Text size="3" tone="muted">Task not found</Text>
          <Button variant="secondary" onClick={() => navigate('/tasks')}>
            Back to tasks
          </Button>
        </Stack>
      </div>
    );
  }

  const filterActors = (text: string, actorList: ActorResponseDto[]) => {
    const lowerText = text.toLowerCase().trim();
    if (!lowerText) return actorList;

    return actorList.filter(actor => {
      if (actor.slug.toLowerCase().includes(lowerText)) return true;
      if (actor.displayName.toLowerCase().includes(lowerText)) return true;
      return false;
    });
  };

  const handleTypingAssignee = (text: string) => {
    setEditAssignee(text);
    setSelectedActor(null);
    const filtered = filterActors(text, actors);
    setFilteredActors(filtered);
    setShowDropdown(true);
    setHighlightedIndex(-1);
  };

  const handleSelectActor = (actor: ActorResponseDto) => {
    setSelectedActor(actor);
    setEditAssignee('');
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleClearSelection = () => {
    setSelectedActor(null);
    setEditAssignee('');
    setFilteredActors(actors);
    setShowDropdown(true);
    setHighlightedIndex(-1);
    // Focus the input after clearing
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filteredActors.length === 0) {
      if (e.key === 'Escape') {
        setShowDropdown(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredActors.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredActors.length) {
          handleSelectActor(filteredActors[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleStartEdit = (field: EditingField) => {
    if (field === 'title') {
      setEditValue(task.name);
    } else if (field === 'description') {
      setEditValue(task.description || '');
    } else if (field === 'assignee') {
      // Fetch actors and show all in dropdown
      fetchActors().then((fetchedActors) => {
        setFilteredActors(fetchedActors);
        if (!task.assigneeActor) {
          setShowDropdown(true);
        }
      });
      setEditAssignee('');
      setSelectedActor(task.assigneeActor || null);
      setHighlightedIndex(-1);
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
      await TasksService.tasksControllerUpdateTask(task.id, { name: editValue.trim() });
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
      await TasksService.tasksControllerUpdateTask(task.id, { description: editValue });
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
    if (!selectedActor) {
      setError('Please select an assignee from the list');
      return;
    }
    setIsLoading(true);
    try {
      console.log(`selectedActor`, selectedActor);
      console.log(`selectedActor.id`, selectedActor.id);
      await TasksService.tasksControllerAssignTask(task.id, {
        assigneeActorId: selectedActor.id
      });
      setEditingField(null);
      setEditAssignee('');
      setSelectedActor(null);
      setFilteredActors([]);
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
      await TasksService.tasksControllerChangeStatus(task.id, { status: newStatus });
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
      await TasksService.tasksControllerAddComment(task.id, { content: newComment.trim() });
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
        <ErrorText>
          <button onClick={() => setError(null)} className="task-detail-page__error-close">×</button>
          {error}
        </ErrorText>
      )}

      {/* Meta */}
      <DataRowContainer className='task-detail-page__section-2'>
        {/* Creator */}
        <DataRow
          leading={<Avatar size={'sm'} name={task.createdByActor.displayName} />}
          tags={[
            StatusTag({ status: task.status }),
            ...task.tags.map(tag => ({ label: tag.name })),
          ]}
          topRight={<Text size='1' tone='muted'>{elapsedTime(task.updatedAt)}</Text>}
        >
          <Text as='span' weight='medium' size='3'>
            {task.createdByActor.displayName}
          </Text>
          <Text as='span' weight='normal' tone='muted' size='3'>
            {` @${task.createdByActor.slug} created `}
          </Text>
          <Text as='span' tone='muted' style='mono'>
            #{task.id.slice(0, 6)}
          </Text>
          {!task.assigneeActor ? (
            <Text tone='muted'>
              unassigned
            </Text>
          ) : (
            null
          )}
        </DataRow>

        {/* Assignee */}
        {task.assigneeActor ? (
          <DataRow
            leading={<Avatar size={'sm'} name={task.assigneeActor.displayName} />}
          >
            <Text as='span' weight='medium' size='3'>
              {task.assigneeActor.displayName}
            </Text>
            <Text as='span' weight='normal' tone='muted' size='3'>
              {` @${task.assigneeActor.slug} assigned`}
            </Text>
          </DataRow>
        ) : (
          null
        )}
      </DataRowContainer >

      {/* Description */}
      <DataRowContainer className='task-detail-page__section-2' >
        <DataRow
          leading={<Avatar size={'sm'} name={task.createdByActor.displayName} />}
          tags={[]}
          topRight={<Text size='1' tone='muted'>{elapsedTime(task.createdAt)}</Text>}
        >
          <Text as='span' weight='medium' size='3'>
            {task.createdByActor.displayName}
          </Text>
          <Text as='span' weight='normal' tone='muted' size='3'>
            {` @${task.createdByActor.slug}`}
          </Text>
          <Text>
            {task.description ? (
              task.description
            ) : (
              'no description'
            )}s
          </Text>
        </DataRow>
      </DataRowContainer >

      {/* Comments */}
      <DataRowContainer className='task-detail-page__section-2' >
        {
          task.comments.map(comment => {
            const name = comment.commenterActor?.displayName || 'unknown';
            const slug = comment.commenterActor?.slug || 'unknown';
            return (
              <DataRow
                leading={<Avatar size={'sm'} name={name} />}
                topRight={<Text size='1' tone='muted'>{elapsedTime(comment.createdAt)}</Text>}
              >
                <Text as='span' weight='medium' size='3'>
                  {name}
                </Text>
                <Text as='span' weight='normal' tone='muted' size='3'>
                  {` @${slug}`}
                </Text>
                <Text>
                  {comment.content}
                </Text>
              </DataRow>
            )
          })
        }
      </DataRowContainer >

      <section className="task-detail-page__section">

        {/* Assignee */}

        {/* Status */}
        <StatusChip status={task.status} />

        {/* Tags */}
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

      {/* Status & Metadata Section */}
      <section className="task-detail-page__section">
        <Text size="2" weight="semibold" tone="muted" as="div" className="task-detail-page__section-label">
          Status
        </Text>
        <div className="task-detail-page__status-buttons">
          {Object.entries(TASKS_STATUS).map(([status, info]) => (
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
            <div className="task-detail-page__autocomplete" ref={autocompleteRef}>
              {selectedActor ? (
                <div
                  className="task-detail-page__input task-detail-page__input--with-actor"
                  onClick={handleClearSelection}
                >
                  <Avatar name={selectedActor.displayName} size="sm" />
                  <Text size="3">@{selectedActor.slug}</Text>
                </div>
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={editAssignee}
                  onChange={(e) => handleTypingAssignee(e.target.value)}
                  onFocus={() => {
                    setFilteredActors(actors);
                    setShowDropdown(true);
                  }}
                  onKeyDown={handleKeyDown}
                  className="task-detail-page__input"
                  placeholder="Search for an assignee..."
                  autoFocus
                  disabled={isLoading}
                />
              )}
              {showDropdown && filteredActors.length > 0 && !selectedActor && (
                <div className="task-detail-page__autocomplete-dropdown">
                  {filteredActors.map((actor, index) => (
                    <div
                      key={actor.id}
                      className={`task-detail-page__autocomplete-item ${index === highlightedIndex ? 'task-detail-page__autocomplete-item--highlighted' : ''}`}
                      onClick={() => handleSelectActor(actor)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <Avatar name={actor.displayName} size="sm" />
                      <Stack spacing="0">
                        <Text size="2" weight="medium">{actor.displayName}</Text>
                        <Text size="1" tone="muted">@{actor.slug}</Text>
                      </Stack>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Row spacing="2">
              <Button size="sm" onClick={handleSaveAssignee} disabled={isLoading || !selectedActor}>
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit} disabled={isLoading}>
                Cancel
              </Button>
            </Row>
          </Stack>
        ) : (
          <div className="task-detail-page__editable" onClick={() => handleStartEdit('assignee')}>
            {task.assigneeActor ? (
              <Row spacing="2">
                <Avatar name={task.assigneeActor.displayName} size="sm" />
                <Text size="3">@{task.assigneeActor.slug}</Text>
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
            <Text size="2">@{task.createdByActor.slug}</Text>
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
    </div >
  );
}

function StatusTag({ status }: { status: TaskStatus }): DataRowTag {
  let color: DataRowTag['color'] = 'gray';
  let label = 'unknown';
  if (status === TaskStatus.DONE) {
    label = 'done';
    color = 'purple';
  } else if (status === TaskStatus.IN_PROGRESS) {
    label = 'in progress';
    color = 'green';
  } else if (status === TaskStatus.NOT_STARTED) {
    label = 'not started';
    color = 'blue';
  } else if (status === TaskStatus.FOR_REVIEW) {
    label = 'in review';
    color = 'orange';
  }
  return {
    label,
    color,
  }
}

function StatusChip({ status }: { status: TaskStatus }) {
  let color: ChipProps['color'] = 'gray';
  let label
  if (status === TaskStatus.DONE) {
    label = 'done';
    color = 'purple';
  } else if (status === TaskStatus.IN_PROGRESS) {
    label = 'in progress';
    color = 'green';
  } else if (status === TaskStatus.NOT_STARTED) {
    label = 'not started';
    color = 'blue';
  } else if (status === TaskStatus.FOR_REVIEW) {
    label = 'in review';
    color = 'orange';
  }
  return (
    <Chip color={color}>
      {label}
    </Chip>
  )
}