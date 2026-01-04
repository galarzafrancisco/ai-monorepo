import { useState, useEffect } from 'react';
import { TaskerooService } from './api';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';
import { TagInput } from './TagInput';

interface CreateTaskFormProps {
  onClose: () => void;
}

export function CreateTaskForm({ onClose }: CreateTaskFormProps) {
  const { toasts, showToast, removeToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [dependsOnIds, setDependsOnIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await TaskerooService.taskerooControllerCreateTask({
        name,
        description,
        ...(assignee && { assignee }),
        ...(sessionId && { sessionId }),
        ...(tagNames.length > 0 && { tagNames }),
        ...(dependsOnIds.length > 0 && { dependsOnIds }),
      });
      onClose();
    } catch (err: any) {
      const errorMessage = err?.body?.detail || err?.message || 'Failed to create task';
      showToast(`Error: ${errorMessage}`, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Task</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Title *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter task name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Enter task description"
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="assignee">Assigned to</label>
            <input
              id="assignee"
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Agent name or assignee"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sessionId">Session ID</label>
            <input
              id="sessionId"
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Agent session ID"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tags">Tags</label>
            <TagInput
              value={tagNames}
              onChange={setTagNames}
              placeholder="Type to add tags..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="dependsOn">Depends On (Task IDs)</label>
            <input
              id="dependsOn"
              type="text"
              value={dependsOnIds.join(', ')}
              onChange={(e) => setDependsOnIds(e.target.value.split(',').map(id => id.trim()).filter(id => id))}
              placeholder="Enter task IDs separated by commas"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>

        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}
