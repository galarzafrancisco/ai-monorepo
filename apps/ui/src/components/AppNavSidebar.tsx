import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface AppNavSidebarProps {
  collapsed: boolean;
}

export function AppNavSidebar({ collapsed }: AppNavSidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    {
      name: 'Home',
      path: '/',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      name: 'Agents',
      path: '/agents',
      icon: '🤖',
    },
    {
      name: 'Taskeroo',
      path: '/taskeroo',
      icon: '📋',
    },
    {
      name: 'Wikiroo',
      path: '/wikiroo',
      icon: '📚',
    },
    {
      name: 'MCP Registry',
      path: '/mcp-registry',
      icon: '🔌',
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="sidebar-nav-container">
      <div className="sidebar-nav-main">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-link ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`
            }
            end={item.path === '/'}
          >
            <div className="sidebar-nav-icon">
              {typeof item.icon === 'string' ? (
                <span>{item.icon}</span>
              ) : (
                item.icon
              )}
            </div>
            <span className="nav-link-text">{item.name}</span>
          </NavLink>
        ))}
      </div>
      <div className="sidebar-nav-bottom">
        <button
          onClick={handleLogout}
          className={`sidebar-nav-link logout-button ${collapsed ? 'collapsed' : ''}`}
          aria-label="Logout"
        >
          <div className="sidebar-nav-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
          <span className="nav-link-text">Logout</span>
        </button>
      </div>
    </nav>
  );
}
