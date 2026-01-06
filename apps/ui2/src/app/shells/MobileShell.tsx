import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Row, Text } from '../../ui/primitives';
import { useInAppNav } from '../providers';
import { APP_NAV_ITEMS, getPageTitle } from './navigation';
import './MobileShell.css';

export interface MobileShellProps {
  children: ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  const location = useLocation();
  const { inAppNav } = useInAppNav();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const pageTitle = getPageTitle(location.pathname);

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  return (
    <div className="mobile-shell" data-shell="mobile">
      {/* Drawer overlay */}
      {isDrawerOpen && (
        <div
          className="mobile-shell__overlay"
          onClick={handleDrawerClose}
        />
      )}

      {/* Drawer */}
      <aside className={`mobile-shell__drawer ${isDrawerOpen ? 'mobile-shell__drawer--open' : ''}`}>
        <div className="mobile-shell__drawer-header">
          <Text size="4" weight="bold">AI Monorepo</Text>
          <button
            className="mobile-shell__drawer-close"
            onClick={handleDrawerClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="mobile-shell__drawer-nav">
          {APP_NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path ||
                           location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`mobile-shell__drawer-item ${isActive ? 'mobile-shell__drawer-item--active' : ''}`}
                onClick={handleDrawerClose}
              >
                <span className="mobile-shell__drawer-icon">{item.icon}</span>
                <span className="mobile-shell__drawer-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Top bar */}
      <header className="mobile-shell__header">
        <Row spacing="3" align="center">
          <button
            className="mobile-shell__hamburger"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <Text size="3" weight="semibold">{pageTitle}</Text>
        </Row>
      </header>

      {/* Main content area with safe area padding */}
      <main className="mobile-shell__main">
        {children}
      </main>

      {/* Bottom navigation - only shown for in-app navigation */}
      {inAppNav && (
        <nav className="mobile-shell__bottom-nav">
          <Row spacing="1" justify="space-between">
            {inAppNav.items.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`mobile-shell__nav-item ${isActive ? 'mobile-shell__nav-item--active' : ''}`}
                >
                  <span className="mobile-shell__nav-icon">{item.icon}</span>
                  <Text size="1" className="mobile-shell__nav-label">
                    {item.label}
                  </Text>
                </Link>
              );
            })}
          </Row>
        </nav>
      )}
    </div>
  );
}
