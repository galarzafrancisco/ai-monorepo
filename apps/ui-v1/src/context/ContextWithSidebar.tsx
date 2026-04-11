import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { PageTree } from './PageTree';
import { useContext } from './useContext';
import type { ContextPageTree } from './types';
import { isMobile } from '../hooks/useIsMobile';

const STORAGE_KEY = 'context-sidebar-collapsed';

export function ContextWithSidebar() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { getPageTree, isConnected, socket } = useContext();

  const [pageTree, setPageTree] = useState<ContextPageTree[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  // Initialize from localStorage, or default to collapsed on mobile
  const [contextSidebarCollapsed, setContextSidebarCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    // Default to collapsed on mobile, expanded on desktop
    return isMobile();
  });

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(contextSidebarCollapsed));
  }, [contextSidebarCollapsed]);

  // Load page tree on mount and when requested
  const loadTree = useCallback(async () => {
    setIsLoadingTree(true);
    try {
      const tree = await getPageTree();
      setPageTree(tree);
    } catch (err) {
      console.error('Failed to load page tree:', err);
    } finally {
      setIsLoadingTree(false);
    }
  }, [getPageTree]);

  // Load page tree on mount
  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Listen to WebSocket events to refresh the tree
  useEffect(() => {
    if (!socket) return;

    const handlePageCreated = () => {
      loadTree();
    };

    const handlePageUpdated = () => {
      loadTree();
    };

    const handlePageDeleted = () => {
      loadTree();
    };

    socket.on('page.created', handlePageCreated);
    socket.on('page.updated', handlePageUpdated);
    socket.on('page.deleted', handlePageDeleted);

    return () => {
      socket.off('page.created', handlePageCreated);
      socket.off('page.updated', handlePageUpdated);
      socket.off('page.deleted', handlePageDeleted);
    };
  }, [socket, loadTree]);

  const handlePageClick = useCallback(
    (id: string) => {
      navigate(`/context/page/${id}`);
    },
    [navigate],
  );

  const toggleSidebar = () => {
    setContextSidebarCollapsed(!contextSidebarCollapsed);
  };

  return (
    <div className="context-with-sidebar">
      <aside className={`sidebar-app-specific ${contextSidebarCollapsed ? 'collapsed' : ''}`}>
        <nav className="sidebar-content">
          {contextSidebarCollapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
              <span
                className={`context-status-dot ${isConnected ? 'connected' : 'disconnected'}`}
                title={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
                aria-label={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
              />
            </div>
          )}
          {!contextSidebarCollapsed && (
            <div>


              <div className="context-sidebar-header">
                <h2 className="context-sidebar-title">
                  📚 Context
                  <span
                    className={`context-status-dot ${isConnected ? 'connected' : 'disconnected'}`}
                    title={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
                    aria-label={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
                  />
                </h2>
                <button
                  className="context-button primary context-sidebar-new-page"
                  type="button"
                  onClick={() => navigate('/context/new')}
                  title="Create new page"
                >
                  + New page
                </button>
              </div>
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
            </div>
          )}
        </nav>
        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={contextSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {contextSidebarCollapsed ? '→' : '←'}
        </button>
      </aside>

      <main className="context-content">
        <Outlet />
      </main>
    </div>
  );
}
