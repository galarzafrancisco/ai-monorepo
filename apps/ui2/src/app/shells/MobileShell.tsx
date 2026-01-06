import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Row, Text } from '../../ui/primitives';
import './MobileShell.css';

export interface MobileShellProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/taskeroo', label: 'Tasks', icon: '✓' },
  { path: '/wikiroo', label: 'Wiki', icon: '📖' },
  { path: '/mcp-registry', label: 'MCP', icon: '🔌' },
  { path: '/agents', label: 'Agents', icon: '🤖' },
];

export function MobileShell({ children }: MobileShellProps) {
  const location = useLocation();

  return (
    <div className="mobile-shell" data-shell="mobile">
      {/* Top bar */}
      <header className="mobile-shell__header">
        <Text size="3" weight="semibold">AI Monorepo</Text>
      </header>

      {/* Main content area with safe area padding */}
      <main className="mobile-shell__main">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="mobile-shell__bottom-nav">
        <Row spacing="1" justify="space-between">
          {NAV_ITEMS.map((item) => {
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
    </div>
  );
}
