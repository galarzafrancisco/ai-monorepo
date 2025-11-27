import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWikiroo } from './useWikiroo';
import { MarkdownPreview } from './MarkdownPreview';
import { WikiPageEditForm } from './WikiPageEditForm';
import { TagSelector } from './TagSelector';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { UpdatePageDto } from 'shared';
import './WikirooMobile.css';

export function WikirooPageViewMobile() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const {
    selectedPage,
    isLoadingPage,
    error,
    selectPage,
    updatePage,
    deletePage,
    isUpdating,
    isDeleting,
    removeTagFromPage,
  } = useWikiroo();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (pageId) {
      selectPage(pageId);
    }
  }, [pageId, selectPage]);

  if (isLoadingPage) {
    return (
      <div className="mobile-wikiroo-page-view">
        <div className="mobile-wikiroo-loading">Loading page...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-wikiroo-page-view">
        <div className="mobile-wikiroo-error">{error}</div>
      </div>
    );
  }

  if (!selectedPage) {
    return (
      <div className="mobile-wikiroo-page-view">
        <div className="mobile-wikiroo-error">Page not found</div>
      </div>
    );
  }

  const formatDateTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTagColor = (index: number): string => {
    const colors = [
      '#007aff', // blue
      '#34c759', // green
      '#ff9500', // orange
      '#af52de', // purple
      '#ff2d55', // pink
      '#5ac8fa', // teal
    ];
    return colors[index % colors.length];
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedPage) return;
    await removeTagFromPage(selectedPage.id, tagId);
  };

  const handleUpdate = useCallback(
    async (updatedPage: any) => {
      if (!pageId) return;
      const payload: UpdatePageDto = {};
      if (updatedPage.title !== selectedPage?.title) payload.title = updatedPage.title;
      if (updatedPage.content !== selectedPage?.content) payload.content = updatedPage.content;
      if (updatedPage.author !== selectedPage?.author) payload.author = updatedPage.author;

      try {
        await updatePage(pageId, payload);
        setShowEditModal(false);
        setErrorMessage('');
      } catch (err: any) {
        const errorMsg = err?.body?.detail || err?.message || 'Failed to update page';
        setErrorMessage(errorMsg);
        throw err;
      }
    },
    [pageId, selectedPage, updatePage],
  );

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pageId) return;
    try {
      await deletePage(pageId);
      setShowDeleteConfirm(false);
      navigate('/wikiroo');
    } catch (err: any) {
      const errorMsg = err?.body?.detail || err?.message || 'Failed to delete page';
      setErrorMessage(errorMsg);
      setShowDeleteConfirm(false);
    }
  }, [pageId, deletePage, navigate]);

  return (
    <div className="mobile-wikiroo-page-view">
      {/* Navigation */}
      <div className="mobile-wikiroo-page-nav">
        <button
          className="mobile-wikiroo-back-button"
          onClick={() => navigate('/wikiroo')}
        >
          ← Back
        </button>
      </div>

      {/* Page Detail */}
      <div className="mobile-wikiroo-page-detail">
        <h1 className="mobile-wikiroo-page-detail-title">{selectedPage.title}</h1>
        <div className="mobile-wikiroo-page-detail-meta">
          <span>By {selectedPage.author}</span>
          <span>•</span>
          <span>Created {formatDateTime(selectedPage.createdAt)}</span>
          <span>•</span>
          <span>Last edited {formatDateTime(selectedPage.updatedAt)}</span>
        </div>

        {/* Tags */}
        {selectedPage.tags && selectedPage.tags.length > 0 && (
          <div className="mobile-wikiroo-page-detail-tags">
            {selectedPage.tags.map((tag, index) => (
              <div
                key={tag.id}
                className="mobile-wikiroo-tag-chip"
                style={{ backgroundColor: getTagColor(index) }}
              >
                {tag.name}
                <button
                  className="mobile-wikiroo-tag-remove"
                  onClick={() => handleRemoveTag(tag.id)}
                  aria-label={`Remove tag ${tag.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="mobile-wikiroo-page-detail-content">
          <MarkdownPreview content={selectedPage.content} />
        </div>

        {/* Actions */}
        <div className="mobile-wikiroo-page-detail-actions">
          <button
            className="mobile-wikiroo-action-button mobile-wikiroo-edit-button"
            onClick={() => setShowEditModal(true)}
            disabled={isUpdating || isDeleting}
          >
            Edit
          </button>
          <button
            className="mobile-wikiroo-action-button mobile-wikiroo-delete-button"
            onClick={handleDeleteClick}
            disabled={isUpdating || isDeleting}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedPage && (
        <WikiPageEditForm
          page={selectedPage}
          onClose={() => setShowEditModal(false)}
          onUpdate={handleUpdate}
          onDelete={handleDeleteConfirm}
          onError={setErrorMessage}
          isUpdating={isUpdating}
          isDeleting={isDeleting}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          message="Are you sure you want to delete this page? This action cannot be undone."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
    </div>
  );
}
