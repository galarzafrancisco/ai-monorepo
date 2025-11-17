import { useState, useEffect } from 'react';
import type { WikiPage } from './types';
import type { UpdatePageDto } from 'shared';
import { TagInput } from './TagInput';

interface WikiPageEditFormProps {
  page: WikiPage;
  onClose: () => void;
  onUpdate: (page: WikiPage) => void;
  onDelete: () => void;
  onError?: (error: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function WikiPageEditForm({
  page,
  onClose,
  onUpdate,
  onDelete,
  onError,
  isUpdating,
  isDeleting,
}: WikiPageEditFormProps) {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [author, setAuthor] = useState(page.author);
  const [tagNames, setTagNames] = useState<string[]>(page.tags?.map(t => t.name) || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: UpdatePageDto = {};
    let hasChanges = false;

    if (title !== page.title) {
      payload.title = title;
      hasChanges = true;
    }
    if (content !== page.content) {
      payload.content = content;
      hasChanges = true;
    }
    if (author !== page.author) {
      payload.author = author;
      hasChanges = true;
    }

    const currentTagNames = page.tags?.map(t => t.name) || [];
    const tagsChanged = JSON.stringify(tagNames.sort()) !== JSON.stringify(currentTagNames.sort());
    if (tagsChanged) {
      payload.tagNames = tagNames;
      hasChanges = true;
    }

    if (!hasChanges) {
      setErrorMessage('No changes to save');
      return;
    }

    try {
      const updatedPage = { ...page, ...payload };
      await onUpdate(updatedPage as WikiPage);
      setErrorMessage('');
    } catch (err: any) {
      const errorMsg = err?.body?.detail || err?.message || 'Failed to update page';
      setErrorMessage(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
      setErrorMessage('');
    } catch (err: any) {
      const errorMsg = err?.body?.detail || err?.message || 'Failed to delete page';
      setErrorMessage(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wiki-edit-form" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Page</h2>
          <button onClick={onClose} className="btn-close">
            ×
          </button>
        </div>

        {errorMessage && (
          <div className="wikiroo-error" style={{ margin: '16px 0' }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="wikiroo-form">
          <div className="wikiroo-form-group">
            <label htmlFor="edit-title">Title *</label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your page a headline"
              required
              disabled={isUpdating || isDeleting}
            />
          </div>

          <div className="wikiroo-form-group">
            <label htmlFor="edit-author">Author *</label>
            <input
              id="edit-author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Who wrote this?"
              required
              disabled={isUpdating || isDeleting}
            />
          </div>

          <div className="wikiroo-form-group">
            <label htmlFor="edit-content">Content *</label>
            <textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write in markdown or plain text"
              rows={15}
              required
              disabled={isUpdating || isDeleting}
            />
          </div>

          <div className="wikiroo-form-group">
            <label htmlFor="edit-tags">Tags</label>
            <TagInput
              value={tagNames}
              onChange={setTagNames}
              placeholder="Type to add tags..."
            />
          </div>

          <div className="wikiroo-form-actions">
            <button
              type="submit"
              className="wikiroo-button primary"
              disabled={isUpdating || isDeleting}
            >
              {isUpdating ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="wikiroo-button secondary"
              disabled={isUpdating || isDeleting}
            >
              Cancel
            </button>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #ddd' }}>
            {showDeleteConfirm ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="wikiroo-button"
                  style={{ backgroundColor: '#dc2626', color: 'white' }}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="wikiroo-button secondary"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="wikiroo-button"
                style={{ backgroundColor: '#dc2626', color: 'white' }}
                disabled={isUpdating || isDeleting}
              >
                Delete Page
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
