import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './HamburgerMenu.css';

export function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

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
      color: '#8e8e93',
    },
    {
      name: 'Taskeroo',
      path: '/taskeroo',
      icon: '📋',
      color: '#3b82f6',
    },
    {
      name: 'Wikiroo',
      path: '/wikiroo',
      icon: '📚',
      color: '#10b981',
    },
    {
      name: 'MCP Registry',
      path: '/mcp-registry',
      icon: '🔌',
      color: '#8b5cf6',
    },
  ];

  return (
    <>
      {/* Hamburger Button */}
      <button
        className="hamburger-button"
        onClick={toggleMenu}
        aria-label="Menu"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="hamburger-overlay"
          onClick={closeMenu}
        />
      )}

      {/* Drawer */}
      <div className={`hamburger-drawer ${isOpen ? 'open' : ''}`}>
        <div className="hamburger-header">
          <h2>Menu</h2>
          <button
            className="hamburger-close"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="hamburger-nav">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`hamburger-nav-item ${isActive ? 'active' : ''}`}
                onClick={closeMenu}
              >
                <div className="hamburger-nav-icon" style={{ color: item.color }}>
                  {typeof item.icon === 'string' ? (
                    <span className="hamburger-emoji">{item.icon}</span>
                  ) : (
                    item.icon
                  )}
                </div>
                <span className="hamburger-nav-label">{item.name}</span>
                {isActive && (
                  <svg
                    className="hamburger-nav-check"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
