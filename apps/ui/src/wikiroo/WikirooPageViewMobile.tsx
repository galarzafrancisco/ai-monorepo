import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWikiroo } from './useWikiroo';
import { MarkdownPreview } from './MarkdownPreview';
import { WikiPageForm } from './WikiPageForm';
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
  } = useWikiroo();
  const [showEditModal, setShowEditModal] = useState(false);
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

  const handleUpdate = useCallback(
    async (payload: UpdatePageDto) => {
      if (!pageId) return;
      await updatePage(pageId, payload);
      setShowEditModal(false);
      setErrorMessage('');
    },
    [pageId, updatePage],
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
      {!showEditModal && (
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
      )}

      {/* Edit Modal */}
      {showEditModal && selectedPage && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Page</h2>
              <button onClick={() => setShowEditModal(false)} className="btn-close">
                ×
              </button>
            </div>
            <WikiPageForm
              mode="edit"
              page={selectedPage}
              onSubmit={handleUpdate}
              onCancel={() => setShowEditModal(false)}
              isSubmitting={isUpdating}
            />
          </div>
        </div>
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
