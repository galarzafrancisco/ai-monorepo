import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import './Wikiroo.css';
import { useWikiroo } from './useWikiroo';
import { MarkdownPreview } from './MarkdownPreview';
import { usePageTitle } from '../hooks/usePageTitle';
import { WikiPageEditForm } from './WikiPageEditForm';
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
  const { pages, selectedPage, isLoadingPage, error, selectPage, updatePage, deletePage, isUpdating, isDeleting } =
    useWikiroo();
  const [showEditForm, setShowEditForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  const handleDelete = useCallback(async () => {
    if (!pageId) return;
    try {
      await deletePage(pageId);
      setShowEditForm(false);
      navigate('/wikiroo');
    } catch (err: any) {
      const errorMsg = err?.body?.detail || err?.message || 'Failed to delete page';
      setErrorMessage(errorMsg);
      throw err;
    }
  }, [pageId, deletePage, navigate]);

  return (
    <div className="wikiroo wikiroo-page-view">
      <header className="wikiroo-header">
        <div>
          <Link to="/wikiroo" className="wikiroo-back-link">
            ← All pages
          </Link>
          <h1>{selectedPage?.title || pageSummary?.title || 'Loading page…'}</h1>
          {(selectedPage || pageSummary) && (
            <div className="wikiroo-meta">
              <span>By {selectedPage?.author || pageSummary?.author}</span>
              {selectedPage && (
                <>
                  <span>Created {formatDate(selectedPage.createdAt)}</span>
                  <span>Updated {formatDate(selectedPage.updatedAt)}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="wikiroo-actions">
          <HomeLink />
          {selectedPage && (
            <button
              className="wikiroo-button"
              type="button"
              onClick={() => setShowEditForm(true)}
              disabled={isLoadingPage || isUpdating || isDeleting}
            >
              Edit Page
            </button>
          )}
          <button
            className="wikiroo-button secondary"
            type="button"
            onClick={handleRefresh}
            disabled={isLoadingPage}
          >
            {isLoadingPage ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <section className="wikiroo-content-panel">
        {isLoadingPage && <div className="wikiroo-status">Loading page…</div>}
        {error && <div className="wikiroo-error">{error}</div>}
        {errorMessage && <div className="wikiroo-error">{errorMessage}</div>}
        {showNotFound && (
          <div className="wikiroo-empty">
            <strong>Page not found</strong>
            <span>The requested page may have been removed or never existed.</span>
          </div>
        )}
        {selectedPage && <MarkdownPreview content={selectedPage.content} />}
      </section>

      {showEditForm && selectedPage && (
        <WikiPageEditForm
          page={selectedPage}
          onClose={() => setShowEditForm(false)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onError={setErrorMessage}
          isUpdating={isUpdating}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
