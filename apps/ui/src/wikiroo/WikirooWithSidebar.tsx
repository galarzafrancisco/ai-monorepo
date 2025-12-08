import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { PageTree } from './PageTree';
import { useWikiroo } from './useWikiroo';
import type { WikiPageTree } from './types';

const STORAGE_KEY = 'wikiroo-sidebar-collapsed';

export function WikirooWithSidebar() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { getPageTree, isConnected } = useWikiroo();

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
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', padding: '8px' }}>
              <span
                className="connection-status-dot"
                style={{ position: 'static', margin: '0 auto' }}
                title="WebSocket connected"
                aria-label="WebSocket connected"
              />
            </div>
          )}
          {!wikirooSidebarCollapsed && (
            <div>


              <div className="wikiroo-sidebar-header">
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <h2 className="wikiroo-sidebar-title">📚 Wikiroo</h2>
                  {isConnected && (
                    <span
                      className="connection-status-dot"
                      title="WebSocket connected"
                      aria-label="WebSocket connected"
                    />
                  )}
                </div>
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
