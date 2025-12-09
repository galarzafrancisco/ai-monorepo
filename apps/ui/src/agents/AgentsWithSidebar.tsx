import { useState, useEffect } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { ChatService } from './api';
import type { ChatSessionResponseDto } from 'shared';

const STORAGE_KEY = 'agents-sidebar-collapsed';

export function AgentsWithSidebar() {
  const { agentId, sessionId } = useParams<{ agentId: string; sessionId: string }>();
  const navigate = useNavigate();

  // Initialize from localStorage, default to false
  const [agentsSidebarCollapsed, setAgentsSidebarCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  // Sessions state
  const [sessions, setSessions] = useState<ChatSessionResponseDto[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await ChatService.chatControllerListSessions();
      setSessions(response.items || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(agentsSidebarCollapsed));
  }, [agentsSidebarCollapsed]);

  const toggleSidebar = () => {
    setAgentsSidebarCollapsed(!agentsSidebarCollapsed);
  };

  return (
    <div className="agents-with-sidebar">
      <aside className={`sidebar-app-specific ${agentsSidebarCollapsed ? 'collapsed' : ''}`}>
        <nav className="sidebar-content">
          {!agentsSidebarCollapsed && (
            <div>
              <div className="agents-sidebar-header">
                <h2 className="agents-sidebar-title">🤖 Agents</h2>
              </div>

              {/* Admin Section */}
              <div className="agents-sidebar-section">
                <button
                  className="agents-sidebar-button"
                  type="button"
                  onClick={() => navigate('/agents/admin')}
                  title="Admin"
                >
                  ⚙️ Admin
                </button>
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

      {/* Right sidebar for resources */}
      <aside className="agents-resources-sidebar">
        <div className="agents-resources-header">
          <h3 className="agents-resources-title">Resources</h3>
        </div>
        <div className="agents-resources-content">
          <div className="agents-resource-section">
            <h4>Tasks</h4>
            <div className="agents-resource-placeholder">No tasks yet</div>
          </div>
          <div className="agents-resource-section">
            <h4>Referenced Content</h4>
            <div className="agents-resource-placeholder">No content referenced</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
