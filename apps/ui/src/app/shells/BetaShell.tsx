import React, { useEffect, useMemo, useState } from "react";
import { useIsDesktop } from "../hooks/useIsDesktop";
import './BetaShellMobile.css';
import './BetaShellDesktop.css';
import { Stack } from "../../ui/primitives";
import { MAIN_NAVEGATION_ITEMS } from "../../shared/const/mainNavegationItems";
import { Link, useLocation } from "react-router-dom";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle";
import { useAuth } from "../../auth/AuthContext";

export function BetaShell({ children }: { children: React.ReactNode }) {
  console.log('Beta shell');

  const { user } = useAuth();
  const location = useLocation();
  useDocumentTitle();

  const navItems = useMemo(() => {
    const showWalkthrough =
      user?.onboardingDisplayMode === 'FULL_PAGE' ||
      user?.onboardingDisplayMode === 'BANNER';

    if (!showWalkthrough) return MAIN_NAVEGATION_ITEMS;

    // Insert walkthrough before Settings
    const settingsIndex = MAIN_NAVEGATION_ITEMS.findIndex((i) => i.path === '/settings');
    const items = [...MAIN_NAVEGATION_ITEMS];
    items.splice(settingsIndex, 0, { path: '/walkthrough', label: 'Walkthrough', icon: '🐣' });
    return items;
  }, [user?.onboardingDisplayMode]);

  // Detect destkop / mobile
  const isDesktop = useIsDesktop();

  // Sidebar collapsible
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored === 'true';
  });
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`${isDesktop ? 'beta-shell__desktop' : 'beta-shell__mobile'}`} data-shell={`${isDesktop ? 'desktop' : 'mobile'}`}>

      {/* Sidebar */}
      {isDesktop && (
        <aside className={`beta-shell__desktop__sidebar ${isCollapsed ? 'beta-shell__desktop__sidebar--collapsed' : ''}`}>
          <nav className='beta-shell__desktop__nav'>
            <div className="beta-shell__desktop__navInner">
              <Stack spacing="1">
                {navItems.map(item => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={isCollapsed ? item.label : undefined}
                      className={`beta-shell__desktop__nav-item ${isActive ? 'beta-shell__desktop__nav-item--active' : ''}`}
                    >
                      <span className="beta-shell__desktop__nav-icon">{item.icon}</span>
                      {!isCollapsed && <span className="beta-shell__desktop__nav-label">{item.label}</span>}
                    </Link>
                  )
                })}
              </Stack>
            </div>
          </nav>
          <button
            className="beta-shell__desktop__sidebar--toggle"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? '→' : '←'}
          </button>
        </aside>
      )
      }

      {/* Content */}
      <div className={`${isDesktop ? "beta-shell__desktop__main" : ""}`}>
        {children}
      </div>
    </div >
  )
}
