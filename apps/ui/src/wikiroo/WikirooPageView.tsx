import { useCallback, useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import './Wikiroo.css';
import { useWikiroo } from './useWikiroo';
import { MarkdownPreview } from './MarkdownPreview';
import { usePageTitle } from '../hooks/usePageTitle';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function WikirooPageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const { pages, selectedPage, isLoadingPage, error, selectPage } = useWikiroo();

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
        {showNotFound && (
          <div className="wikiroo-empty">
            <strong>Page not found</strong>
            <span>The requested page may have been removed or never existed.</span>
          </div>
        )}
        {selectedPage && <MarkdownPreview content={selectedPage.content} />}
      </section>
    </div>
  );
}
