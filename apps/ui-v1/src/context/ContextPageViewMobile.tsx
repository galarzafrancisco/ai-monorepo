import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContext } from './useContext';
import { MarkdownPreview } from './MarkdownPreview';
import { ContextPageForm } from './ContextPageForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Breadcrumb } from './Breadcrumb';
import type { UpdateBlockDto } from "@taico/client";
import './ContextMobile.css';

export function ContextPageViewMobile() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const {
    pages,
    selectedPage,
    isLoadingPage,
    error,
    selectPage,
    updatePage,
    deletePage,
    isUpdating,
    isDeleting,
  } = useContext();
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
      <div className="mobile-context-page-view">
        <div className="mobile-context-loading">Loading page...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-context-page-view">
        <div className="mobile-context-error">{error}</div>
      </div>
    );
  }

  if (!selectedPage) {
    return (
      <div className="mobile-context-page-view">
        <div className="mobile-context-error">Page not found</div>
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
    async (payload: UpdateBlockDto) => {
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
      navigate('/context');
    } catch (err: any) {
      const errorMsg = err?.body?.detail || err?.message || 'Failed to delete page';
      setErrorMessage(errorMsg);
      setShowDeleteConfirm(false);
    }
  }, [pageId, deletePage, navigate]);

  return (
    <div className="mobile-context-page-view">
      {/* Navigation */}
      <div className="mobile-context-page-nav">
        <button
          className="mobile-context-back-button"
          onClick={() => navigate('/context')}
        >
          ← Back
        </button>
      </div>

      {/* Page Detail */}
      {!showEditModal && (
      <div className="mobile-context-page-detail">
        {pageId && <Breadcrumb pageId={pageId} pages={pages} />}
        <h1 className="mobile-context-page-detail-title">{selectedPage.title}</h1>
        <div className="mobile-context-page-detail-meta">
          <span>By {selectedPage.createdBy || 'unknown'}</span>
          <span>•</span>
          <span>Created {formatDateTime(selectedPage.createdAt)}</span>
          <span>•</span>
          <span>Last edited {formatDateTime(selectedPage.updatedAt)}</span>
        </div>

        {/* Tags */}
        {selectedPage.tags && selectedPage.tags.length > 0 && (
          <div className="mobile-context-page-detail-tags">
            {selectedPage.tags.map((tag, index) => (
              <div
                key={tag.name}
                className="mobile-context-tag-chip"
                style={{ backgroundColor: getTagColor(index) }}
              >
                {tag.name}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="mobile-context-page-detail-content">
          <MarkdownPreview content={selectedPage.content} />
        </div>

        {/* Actions */}
        <div className="mobile-context-page-detail-actions">
          <button
            className="mobile-context-action-button mobile-context-edit-button"
            onClick={() => setShowEditModal(true)}
            disabled={isUpdating || isDeleting}
          >
            Edit
          </button>
          <button
            className="mobile-context-action-button mobile-context-delete-button"
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
            <ContextPageForm
              mode="edit"
              page={selectedPage}
              pages={pages}
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
