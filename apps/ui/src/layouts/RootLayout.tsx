import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AppNavSidebar } from '../components/AppNavSidebar';

const STORAGE_KEY = 'app-nav-collapsed';

const isMobile = () => {
  return window.innerWidth < 768;
};

export function RootLayout() {
  // Initialize from localStorage, or default to collapsed on mobile
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    // Default to collapsed on mobile, expanded on desktop
    return isMobile();
  });

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(navCollapsed));
  }, [navCollapsed]);

  const toggleNav = () => {
    setNavCollapsed(!navCollapsed);
  };

  return (
    <div className="root-layout">
      <aside className={`sidebar-app-nav ${navCollapsed ? 'collapsed' : ''}`}>
        <nav className="sidebar-content">
          <AppNavSidebar collapsed={navCollapsed} />
        </nav>
        <button
          className="sidebar-toggle"
          onClick={toggleNav}
          aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {navCollapsed ? '→' : '←'}
        </button>
      </aside>
      <div className="root-layout-main">
        <Outlet />
      </div>
    </div>
  );
}
