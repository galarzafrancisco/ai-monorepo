import { useState, useEffect } from 'react';
import type { WikiPage } from './types';
import type { UpdatePageDto } from 'shared';

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
          <div className="error-message">
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="detail-section">
            <label htmlFor="title">
              <strong>Title</strong>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter page title..."
              required
              disabled={isUpdating || isDeleting}
            />
          </div>

          <div className="detail-section">
            <label htmlFor="author">
              <strong>Author</strong>
            </label>
            <input
              id="author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Enter author name..."
              required
              disabled={isUpdating || isDeleting}
            />
          </div>

          <div className="detail-section">
            <label htmlFor="content">
              <strong>Content (Markdown)</strong>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter page content in markdown format..."
              className="content-textarea"
              rows={15}
              required
              disabled={isUpdating || isDeleting}
            />
          </div>

          <div className="detail-section">
            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={isUpdating || isDeleting}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isUpdating || isDeleting}
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="detail-section">
            <div className="task-actions">
              {showDeleteConfirm ? (
                <div className="delete-confirm">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="btn-danger"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn-secondary"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger"
                  disabled={isUpdating || isDeleting}
                >
                  Delete Page
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
