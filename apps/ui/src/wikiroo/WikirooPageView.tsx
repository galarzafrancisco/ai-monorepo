import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import './Wikiroo.css';
import { useWikiroo } from './useWikiroo';
import { MarkdownPreview } from './MarkdownPreview';
import { usePageTitle } from '../hooks/usePageTitle';
import { WikiPageEditForm } from './WikiPageEditForm';
import { TagBadge } from './TagBadge';
import { TagSelector } from './TagSelector';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { UpdatePageDto } from 'shared';

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
    error,
    selectPage,
    updatePage,
    deletePage,
    isUpdating,
    isDeleting,
    addTagToPage,
    removeTagFromPage,
  } = useWikiroo();
  const [showEditForm, setShowEditForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const pageSummary = pages.find((page) => page.id === pageId);
  const pageTitle = selectedPage?.title || pageSummary?.title;
  usePageTitle(pageTitle ? `Wikiroo — ${pageTitle}` : 'Wikiroo');

  useEffect(() => {
    if (pageId) {
      selectPage(pageId);
    }
  }, [pageId, selectPage]);

  if (!pageId) {
    return <Navigate to="/wikiroo" replace />;
  }

  const showNotFound =
    !isLoadingPage && !selectedPage && !error && pages.length > 0 && !pageSummary;
  const handleRefresh = useCallback(() => {
    if (pageId) {
      selectPage(pageId);
    }
  }, [pageId, selectPage]);

  const handleUpdate = useCallback(
    async (updatedPage: any) => {
      if (!pageId) return;
      const payload: UpdatePageDto = {};
      if (updatedPage.title !== selectedPage?.title) payload.title = updatedPage.title;
      if (updatedPage.content !== selectedPage?.content) payload.content = updatedPage.content;
      if (updatedPage.author !== selectedPage?.author) payload.author = updatedPage.author;

      try {
        await updatePage(pageId, payload);
        setShowEditForm(false);
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

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      if (!pageId) return;
      try {
        await removeTagFromPage(pageId, tagId);
        setErrorMessage('');
      } catch (err: any) {
        const errorMsg = err?.body?.detail || err?.message || 'Failed to remove tag';
        setErrorMessage(errorMsg);
      }
    },
    [pageId, removeTagFromPage],
  );

  const handleTagAdded = useCallback(() => {
    if (pageId) {
      selectPage(pageId);
    }
  }, [pageId, selectPage]);

  return (
    <div className="wikiroo wikiroo-page-view">
      <div className="wikiroo-page-navigation">
        <Link to="/wikiroo" className="wikiroo-back-link">
          ← All pages
        </Link>
        <HomeLink />
      </div>

      {isLoadingPage && <div className="wikiroo-status">Loading page…</div>}
      {error && <div className="wikiroo-error">{error}</div>}
      {errorMessage && <div className="wikiroo-error">{errorMessage}</div>}
      {showNotFound && (
        <div className="wikiroo-empty">
          <strong>Page not found</strong>
          <span>The requested page may have been removed or never existed.</span>
        </div>
      )}

      {selectedPage && (
        <div className="wikiroo-page-detail">
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
                <TagBadge key={tag.id} tag={tag} onRemove={() => handleRemoveTag(tag.id)} />
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
              onClick={() => setShowEditForm(true)}
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

      {showEditForm && selectedPage && (
        <WikiPageEditForm
          page={selectedPage}
          onClose={() => setShowEditForm(false)}
          onUpdate={handleUpdate}
          onDelete={handleDeleteConfirm}
          onError={setErrorMessage}
          isUpdating={isUpdating}
          isDeleting={isDeleting}
        />
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
    </div>
  );
}
