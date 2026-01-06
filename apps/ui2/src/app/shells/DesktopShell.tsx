import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Stack, Text } from '../../ui/primitives';
import './DesktopShell.css';

export interface DesktopShellProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/taskeroo', label: 'Taskeroo' },
  { path: '/wikiroo', label: 'Wikiroo' },
  { path: '/mcp-registry', label: 'MCP Registry' },
  { path: '/agents', label: 'Agents' },
];

export function DesktopShell({ children }: DesktopShellProps) {
  const location = useLocation();

  return (
    <div className="desktop-shell" data-shell="desktop">
      {/* Sidebar */}
      <aside className="desktop-shell__sidebar">
        <Stack spacing="2">
          <div className="desktop-shell__brand">
            <Text size="4" weight="semibold">AI Monorepo</Text>
          </div>
          <nav className="desktop-shell__nav">
            <Stack spacing="1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`desktop-shell__nav-item ${isActive ? 'desktop-shell__nav-item--active' : ''}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </Stack>
          </nav>
        </Stack>
      </aside>

      {/* Main content area */}
      <main className="desktop-shell__main">
        {children}
      </main>
    </div>
  );
}
