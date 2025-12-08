import { NavLink } from 'react-router-dom';

interface AppNavSidebarProps {
  collapsed: boolean;
}

export function AppNavSidebar({ collapsed }: AppNavSidebarProps) {
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

  return (
    <nav>
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
    </nav>
  );
}
