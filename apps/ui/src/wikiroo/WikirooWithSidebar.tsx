import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { PageTree } from './PageTree';
import { useWikiroo } from './useWikiroo';
import type { WikiPageTree } from './types';

const STORAGE_KEY = 'wikiroo-sidebar-collapsed';

export function WikirooWithSidebar() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { getPageTree, isConnected, socket } = useWikiroo();

  const [pageTree, setPageTree] = useState<WikiPageTree[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  // Initialize from localStorage, default to false
  const [wikirooSidebarCollapsed, setWikirooSidebarCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(wikirooSidebarCollapsed));
  }, [wikirooSidebarCollapsed]);

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
      navigate(`/wikiroo/page/${id}`);
    },
    [navigate],
  );

  const toggleSidebar = () => {
    setWikirooSidebarCollapsed(!wikirooSidebarCollapsed);
  };

  return (
    <div className="wikiroo-with-sidebar">
      <aside className={`sidebar-app-specific ${wikirooSidebarCollapsed ? 'collapsed' : ''}`}>
        <nav className="sidebar-content">
          {wikirooSidebarCollapsed && isConnected && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
              <span
                className="wikiroo-status-dot"
                title="WebSocket connected"
                aria-label="WebSocket connected"
              />
            </div>
          )}
          {!wikirooSidebarCollapsed && (
            <div>


              <div className="wikiroo-sidebar-header">
                <h2 className="wikiroo-sidebar-title">
                  📚 Wikiroo
                  {isConnected && (
                    <span
                      className="wikiroo-status-dot"
                      title="WebSocket connected"
                      aria-label="WebSocket connected"
                    />
                  )}
                </h2>
                <button
                  className="wikiroo-button primary wikiroo-sidebar-new-page"
                  type="button"
                  onClick={() => navigate('/wikiroo/new')}
                  title="Create new page"
                >
                  + New page
                </button>
              </div>
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
            </div>
          )}
        </nav>
        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={wikirooSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {wikirooSidebarCollapsed ? '→' : '←'}
        </button>
      </aside>

      <main className="wikiroo-content">
        <Outlet />
      </main>
    </div>
  );
}
