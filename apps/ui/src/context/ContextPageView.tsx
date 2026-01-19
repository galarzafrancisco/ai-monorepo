import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContext } from './useContext';
import { MarkdownPreview } from './MarkdownPreview';
import { usePageTitle } from '../hooks/usePageTitle';
import { TagBadge } from './TagBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Breadcrumb } from './Breadcrumb';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ContextPageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const {
    pages,
    selectedPage,
    isLoadingPage,
    isUpdating,
    isDeleting,
    error,
    selectPage,
    deletePage,
    getPageTree,
  } = useContext();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  usePageTitle(selectedPage?.title ? `Context — ${selectedPage.title}` : 'Context');

  useEffect(() => {
    if (pageId) {
      selectPage(pageId);
    }
  }, [pageId, selectPage]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pageId) return;
    try {
      await deletePage(pageId);
      setShowDeleteConfirm(false);
      // Reload tree to remove deleted page
      await getPageTree();
      navigate('/context');
    } catch (err: any) {
      const errorMsg = err?.body?.detail || err?.message || 'Failed to delete page';
      setErrorMessage(errorMsg);
      setShowDeleteConfirm(false);
    }
  }, [pageId, deletePage, navigate, getPageTree]);

  return (
    <>
      {isLoadingPage && <div className="context-status">Loading page…</div>}

      {error && <div className="context-error">{error}</div>}
      {errorMessage && <div className="context-error">{errorMessage}</div>}

      {selectedPage && pageId && (
        <div className="context-page-detail">
          <Breadcrumb pageId={pageId} pages={pages} />
          <div className="context-page-detail-header">
            <h1 className="context-page-detail-title">{selectedPage.title}</h1>
            <div className="context-page-detail-meta">
              <span>By {selectedPage.author}</span>
              <span>•</span>
              <span>Created {formatDate(selectedPage.createdAt)}</span>
              <span>•</span>
              <span>Last edited {formatDate(selectedPage.updatedAt)}</span>
            </div>
          </div>

          {selectedPage.tags && selectedPage.tags.length > 0 && (
            <div className="context-page-detail-tags">
              {selectedPage.tags.map((tag) => (
                <TagBadge key={tag.name} tag={tag} />
              ))}
            </div>
          )}

          <div className="context-page-detail-content">
            <MarkdownPreview content={selectedPage.content} />
          </div>

          <div className="context-page-detail-actions">
            <button
              className="context-button"
              type="button"
              onClick={() => navigate(`/context/page/${pageId}/edit`)}
              disabled={isUpdating || isDeleting}
            >
              Edit
            </button>
            <button
              className="context-button context-button-danger"
              type="button"
              onClick={handleDeleteClick}
              disabled={isUpdating || isDeleting}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          message="Are you sure you want to delete this page? This action cannot be undone."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
    </>
  );
}
