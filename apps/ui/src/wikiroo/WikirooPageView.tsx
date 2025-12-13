import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWikiroo } from './useWikiroo';
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

export function WikirooPageView() {
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
  } = useWikiroo();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  usePageTitle(selectedPage?.title ? `Wikiroo — ${selectedPage.title}` : 'Wikiroo');

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
      navigate('/wikiroo');
    } catch (err: any) {
      const errorMsg = err?.body?.detail || err?.message || 'Failed to delete page';
      setErrorMessage(errorMsg);
      setShowDeleteConfirm(false);
    }
  }, [pageId, deletePage, navigate, getPageTree]);

  return (
    <>
      {isLoadingPage && <div className="wikiroo-status">Loading page…</div>}

      {error && <div className="wikiroo-error">{error}</div>}
      {errorMessage && <div className="wikiroo-error">{errorMessage}</div>}

      {selectedPage && pageId && (
        <div className="wikiroo-page-detail">
          <Breadcrumb pageId={pageId} pages={pages} />
          <div className="wikiroo-page-detail-header">
            <h1 className="wikiroo-page-detail-title">{selectedPage.title}</h1>
            <div className="wikiroo-page-detail-meta">
              <span>By {selectedPage.author}</span>
              <span>•</span>
              <span>Created {formatDate(selectedPage.createdAt)}</span>
              <span>•</span>
              <span>Last edited {formatDate(selectedPage.updatedAt)}</span>
            </div>
          </div>

          {selectedPage.tags && selectedPage.tags.length > 0 && (
            <div className="wikiroo-page-detail-tags">
              {selectedPage.tags.map((tag) => (
                <TagBadge key={tag.name} tag={tag} />
              ))}
            </div>
          )}

          <div className="wikiroo-page-detail-content">
            <MarkdownPreview content={selectedPage.content} />
          </div>

          <div className="wikiroo-page-detail-actions">
            <button
              className="wikiroo-button"
              type="button"
              onClick={() => navigate(`/wikiroo/page/${pageId}/edit`)}
              disabled={isUpdating || isDeleting}
            >
              Edit
            </button>
            <button
              className="wikiroo-button wikiroo-button-danger"
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
