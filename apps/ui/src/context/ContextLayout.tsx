import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { HomeLink } from '../components/HomeLink';
import './Context.css';
import { useContext } from './useContext';
import { MarkdownPreview } from './MarkdownPreview';
import { usePageTitle } from '../hooks/usePageTitle';
import { ContextPageForm } from './ContextPageForm';
import { TagBadge } from './TagBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Breadcrumb } from './Breadcrumb';
import { PageTree } from './PageTree';
import type { UpdateBlockDto, CreateBlockDto } from "@taico/client";
import type { ContextPageTree } from './types';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ContextLayout() {
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
  } = useContext();

  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pageTree, setPageTree] = useState<ContextPageTree[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [manualSidebarCollapse, setManualSidebarCollapse] = useState(false);

  // Determine current view from route
  const isEditMode = location.pathname.endsWith('/edit');
  const isCreateMode = location.pathname === '/context/new';
  const isPageView = pageId && !isEditMode;

  // Sidebar is collapsed when viewing, editing, or creating a page, or manually collapsed
  const isSidebarCollapsed = isPageView || isEditMode || isCreateMode || manualSidebarCollapse;

  const pageSummary = pages.find((page) => page.id === pageId);
  const pageTitle = selectedPage?.title || pageSummary?.title;
  usePageTitle(pageTitle ? `Context — ${pageTitle}` : 'Context');

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
      navigate(`/context/page/${id}`);
    },
    [navigate],
  );

  const handleCreatePage = async (data: CreateBlockDto) => {
    const created = await createPage(data);
    // Reload tree to show new page
    const tree = await getPageTree();
    setPageTree(tree);
    navigate(`/context/page/${created.id}`);
  };

  const handleUpdate = useCallback(
    async (payload: UpdateBlockDto) => {
      if (!pageId) return;
      await updatePage(pageId, payload);
      setErrorMessage('');
      // Reload tree in case title changed
      const tree = await getPageTree();
      setPageTree(tree);
      // Navigate back to page view
      navigate(`/context/page/${pageId}`);
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
      navigate('/context');
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
    <div className="context context-layout">
      <header className="context-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="context-button secondary"
            type="button"
            onClick={() => setManualSidebarCollapse((prev) => !prev)}
            title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {isSidebarCollapsed ? '☰' : '←'}
          </button>
          <h1>Context</h1>
        </div>
        <div className="context-actions">
          <HomeLink />
          <button
            className="context-button secondary"
            type="button"
            onClick={handleRefresh}
            disabled={isLoadingTree}
          >
            {isLoadingTree ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            className="context-button primary"
            type="button"
            onClick={() => navigate('/context/new')}
          >
            New page
          </button>
        </div>
      </header>

      <div className="context-main-container">
        {/* Left sidebar with tree navigation */}
        <aside className={`context-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <h2 className="context-sidebar-title">Pages</h2>
          {isLoadingTree && <div className="context-status">Loading pages…</div>}
          {pageTree.length > 0 && (
            <PageTree
              pages={pageTree}
              currentPageId={pageId}
              onPageClick={handlePageClick}
            />
          )}
          {pageTree.length === 0 && !isLoadingTree && (
            <div className="context-empty-sidebar">
              <span>No pages yet</span>
            </div>
          )}
        </aside>

        {/* Right content area */}
        <main className="context-content">
          {/* Create page form (/context/new) */}
          {isCreateMode && (
            <div className="context-edit-container">
              <div className="context-edit-header">
                <h2>New Page</h2>
                <button
                  onClick={() => navigate('/context')}
                  className="context-button secondary"
                >
                  Close
                </button>
              </div>
              <ContextPageForm
                mode="create"
                pages={pages}
                onSubmit={handleCreatePage}
                onCancel={() => navigate('/context')}
                isSubmitting={isCreating}
              />
            </div>
          )}

          {/* Edit page form (/context/page/:pageId/edit) */}
          {isEditMode && selectedPage && (
            <div className="context-edit-container">
              <div className="context-edit-header">
                <h2>Edit Page</h2>
                <button
                  onClick={() => navigate(`/context/page/${pageId}`)}
                  className="context-button secondary"
                >
                  Close
                </button>
              </div>
              <ContextPageForm
                mode="edit"
                page={selectedPage}
                pages={pages}
                onSubmit={handleUpdate}
                onCancel={() => navigate(`/context/page/${pageId}`)}
                isSubmitting={isUpdating}
              />
            </div>
          )}

          {/* Welcome screen (/context) */}
          {!pageId && !isCreateMode && (
            <div className="context-welcome">
              <h2>Context</h2>
            </div>
          )}

          {/* Page view (/context/page/:pageId) */}
          {isPageView && isLoadingPage && (
            <div className="context-status">Loading page…</div>
          )}

          {isPageView && error && <div className="context-error">{error}</div>}
          {errorMessage && <div className="context-error">{errorMessage}</div>}

          {isPageView && selectedPage && (
            <div className="context-page-detail">
              <Breadcrumb pageId={pageId} pages={pages} />
              <div className="context-page-detail-header">
                <h1 className="context-page-detail-title">{selectedPage.title}</h1>
                <div className="context-page-detail-meta">
                  <span>By {selectedPage.createdBy || 'unknown'}</span>
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
