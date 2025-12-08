import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AppNavSidebar } from '../components/AppNavSidebar';
import { useWikiroo } from '../wikiroo/useWikiroo';

const STORAGE_KEY = 'app-nav-collapsed';

export function RootLayout() {
  // Initialize from localStorage, default to false
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  // Get Wikiroo connection status
  const { isConnected: wikirooConnected } = useWikiroo();

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
          <AppNavSidebar collapsed={navCollapsed} wikirooConnected={wikirooConnected} />
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
