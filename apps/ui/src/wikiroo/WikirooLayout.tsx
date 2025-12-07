import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import './Wikiroo.css';
import { useWikiroo } from './useWikiroo';
import { MarkdownPreview } from './MarkdownPreview';
import { usePageTitle } from '../hooks/usePageTitle';
import { WikiPageForm } from './WikiPageForm';
import { TagBadge } from './TagBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Breadcrumb } from './Breadcrumb';
import { PageTree } from './PageTree';
import type { UpdatePageDto, CreatePageDto } from 'shared';
import type { WikiPageTree } from './types';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function WikirooLayout() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const location = window.location;
  const {
    pages,
    selectedPage,
    isLoadingPage,
    isLoadingList,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    selectPage,
    updatePage,
    deletePage,
    createPage,
    getPageTree,
  } = useWikiroo();

  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pageTree, setPageTree] = useState<WikiPageTree[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [manualSidebarCollapse, setManualSidebarCollapse] = useState(false);

  // Determine current view from route
  const isEditMode = location.pathname.endsWith('/edit');
  const isCreateMode = location.pathname === '/wikiroo/new';
  const isPageView = pageId && !isEditMode;

  // Sidebar is collapsed when viewing a page (not editing/creating) or manually collapsed
  const isSidebarCollapsed = isPageView || manualSidebarCollapse;

  const pageSummary = pages.find((page) => page.id === pageId);
  const pageTitle = selectedPage?.title || pageSummary?.title;
  usePageTitle(pageTitle ? `Wikiroo — ${pageTitle}` : 'Wikiroo');

  // Load page tree on mount
  useEffect(() => {
    async function loadTree() {
      setIsLoadingTree(true);
      try {
        const tree = await getPageTree();
        setPageTree(tree);
      } catch (err) {
        console.error('Failed to load page tree:', err);
      } finally {
        setIsLoadingTree(false);
      }
    }
    loadTree();
  }, [getPageTree]);

  // Load selected page when pageId changes
  useEffect(() => {
    if (pageId) {
      selectPage(pageId);
    }
  }, [pageId, selectPage]);

  const handlePageClick = useCallback(
    (id: string) => {
      navigate(`/wikiroo/page/${id}`);
    },
    [navigate],
  );

  const handleCreatePage = async (data: CreatePageDto) => {
    const created = await createPage(data);
    // Reload tree to show new page
    const tree = await getPageTree();
    setPageTree(tree);
    navigate(`/wikiroo/page/${created.id}`);
  };

  const handleUpdate = useCallback(
    async (payload: UpdatePageDto) => {
      if (!pageId) return;
      await updatePage(pageId, payload);
      setErrorMessage('');
      // Reload tree in case title changed
      const tree = await getPageTree();
      setPageTree(tree);
      // Navigate back to page view
      navigate(`/wikiroo/page/${pageId}`);
    },
    [pageId, updatePage, getPageTree, navigate],
  );

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pageId) return;
    try {
      await deletePage(pageId);
      setShowDeleteConfirm(false);
      // Reload tree to remove deleted page
      const tree = await getPageTree();
      setPageTree(tree);
      navigate('/wikiroo');
    } catch (err: any) {
      const errorMsg = err?.body?.detail || err?.message || 'Failed to delete page';
      setErrorMessage(errorMsg);
      setShowDeleteConfirm(false);
    }
  }, [pageId, deletePage, navigate, getPageTree]);

  const handleRefresh = async () => {
    setIsLoadingTree(true);
    try {
      const tree = await getPageTree();
      setPageTree(tree);
      if (pageId) {
        selectPage(pageId);
      }
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setIsLoadingTree(false);
    }
  };

  return (
    <div className="wikiroo wikiroo-layout">
      <header className="wikiroo-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="wikiroo-button secondary"
            type="button"
            onClick={() => setManualSidebarCollapse((prev) => !prev)}
            title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {isSidebarCollapsed ? '☰' : '←'}
          </button>
          <h1>Wikiroo</h1>
        </div>
        <div className="wikiroo-actions">
          <HomeLink />
          <button
            className="wikiroo-button secondary"
            type="button"
            onClick={handleRefresh}
            disabled={isLoadingTree}
          >
            {isLoadingTree ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="wikiroo-button primary"
            type="button"
            onClick={() => navigate('/wikiroo/new')}
          >
            New page
          </button>
        </div>
      </header>

      <div className="wikiroo-main-container">
        {/* Left sidebar with tree navigation */}
        <aside className={`wikiroo-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <h2 className="wikiroo-sidebar-title">Pages</h2>
          {isLoadingTree && <div className="wikiroo-status">Loading pages…</div>}
          {pageTree.length > 0 && (
            <PageTree
              pages={pageTree}
              currentPageId={pageId}
              onPageClick={handlePageClick}
            />
          )}
          {pageTree.length === 0 && !isLoadingTree && (
            <div className="wikiroo-empty-sidebar">
              <span>No pages yet</span>
            </div>
          )}
        </aside>

        {/* Right content area */}
        <main className="wikiroo-content">
          {/* Create page form (/wikiroo/new) */}
          {isCreateMode && (
            <div className="wikiroo-edit-container">
              <div className="wikiroo-edit-header">
                <h2>New Page</h2>
                <button
                  onClick={() => navigate('/wikiroo')}
                  className="wikiroo-button secondary"
                >
                  Close
                </button>
              </div>
              <WikiPageForm
                mode="create"
                pages={pages}
                onSubmit={handleCreatePage}
                onCancel={() => navigate('/wikiroo')}
                isSubmitting={isCreating}
              />
            </div>
          )}

          {/* Edit page form (/wikiroo/page/:pageId/edit) */}
          {isEditMode && selectedPage && (
            <div className="wikiroo-edit-container">
              <div className="wikiroo-edit-header">
                <h2>Edit Page</h2>
                <button
                  onClick={() => navigate(`/wikiroo/page/${pageId}`)}
                  className="wikiroo-button secondary"
                >
                  Close
                </button>
              </div>
              <WikiPageForm
                mode="edit"
                page={selectedPage}
                pages={pages}
                onSubmit={handleUpdate}
                onCancel={() => navigate(`/wikiroo/page/${pageId}`)}
                isSubmitting={isUpdating}
              />
            </div>
          )}

          {/* Welcome screen (/wikiroo) */}
          {!pageId && !isCreateMode && (
            <div className="wikiroo-welcome">
              <h2>Wikiroo</h2>
            </div>
          )}

          {/* Page view (/wikiroo/page/:pageId) */}
          {isPageView && isLoadingPage && (
            <div className="wikiroo-status">Loading page…</div>
          )}

          {isPageView && error && <div className="wikiroo-error">{error}</div>}
          {errorMessage && <div className="wikiroo-error">{errorMessage}</div>}

          {isPageView && selectedPage && (
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
        </main>
      </div>

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
