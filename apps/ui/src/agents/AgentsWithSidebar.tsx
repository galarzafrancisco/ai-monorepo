import { useState, useEffect } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useChatSessions } from './useChatSessions';

const STORAGE_KEY = 'agents-sidebar-collapsed';

const isMobile = () => {
  return window.innerWidth < 768;
};

export function AgentsWithSidebar() {
  const { agentId, sessionId } = useParams<{ agentId: string; sessionId: string }>();
  const navigate = useNavigate();

  // Initialize from localStorage, or default to collapsed on mobile
  const [agentsSidebarCollapsed, setAgentsSidebarCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    // Default to collapsed on mobile, expanded on desktop
    return isMobile();
  });

  // Use WebSocket hook for real-time session updates
  const { sessions, loading: sessionsLoading, isConnected } = useChatSessions();

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(agentsSidebarCollapsed));
  }, [agentsSidebarCollapsed]);

  const toggleSidebar = () => {
    setAgentsSidebarCollapsed(!agentsSidebarCollapsed);
  };

  const isAdminActive = window.location.pathname.includes('/agents/admin');
  const isAgentsHomeActive = window.location.pathname === '/agents' || window.location.pathname === '/agents/';

  return (
    <div className="agents-with-sidebar">
      <aside className={`sidebar-app-specific ${agentsSidebarCollapsed ? 'collapsed' : ''}`}>
        <nav className="sidebar-content">
          {!agentsSidebarCollapsed && (
            <div>
              <div className="agents-sidebar-header">
                <h2 className="agents-sidebar-title">
                  🤖 Agents
                  <span
                    className={`agents-status-dot ${isConnected ? 'connected' : 'disconnected'}`}
                    title={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
                  />
                </h2>
              </div>

              {/* Navigation Section */}
              <div className="agents-sidebar-section">
                <div className="agents-nav-list">
                  <div
                    className={`agents-nav-item ${isAgentsHomeActive ? 'active' : ''}`}
                    onClick={() => navigate('/agents')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate('/agents');
                      }
                    }}
                    title="Agents"
                  >
                    🤖 Agents
                  </div>
                  <div
                    className={`agents-nav-item ${isAdminActive ? 'active' : ''}`}
                    onClick={() => navigate('/agents/admin')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate('/agents/admin');
                      }
                    }}
                    title="Admin"
                  >
                    ⚙️ Admin
                  </div>
                </div>
              </div>

              {/* History Section */}
              <div className="agents-sidebar-section">
                <h3 className="agents-sidebar-section-title">History</h3>
                <div className="agents-history-list">
                  {sessionsLoading && (
                    <div className="agents-history-item">Loading sessions...</div>
                  )}
                  {!sessionsLoading && sessions.length === 0 && (
                    <div className="agents-history-item">No sessions yet</div>
                  )}
                  {!sessionsLoading && sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`agents-history-item ${sessionId === session.id ? 'active' : ''}`}
                      onClick={() => navigate(`/agents/${session.agentId}/session/${session.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          navigate(`/agents/${session.agentId}/session/${session.id}`);
                        }
                      }}
                      title={session.title}
                    >
                      {session.title}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </nav>
        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={agentsSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {agentsSidebarCollapsed ? '→' : '←'}
        </button>
      </aside>

      <main className="agents-content">
        <Outlet />
      </main>
    </div>
  );
}
