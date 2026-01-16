// // DesktopLayout.tsx
// import { Outlet } from "react-router-dom";
// import { Link, useLocation } from "react-router-dom";
// import { useShellConfig } from "../providers/ShellConfigProvider";
// import "../shells/DesktopShell.css";

// export function DesktopLayout() {
//   const cfg = useShellConfig();
//   const location = useLocation();

//   return (
//     <div className="desktop-shell">
//       <header className="desktop-shell__header">
//         <div className="desktop-shell__title">
//           <div className="desktop-shell__app-title">{cfg.appTitle}</div>
//           {cfg.sectionTitle ? <div className="desktop-shell__section-title">{cfg.sectionTitle}</div> : null}
//         </div>

//         {/* Optional: top-nav from cfg.navItems or global app nav */}
//         {cfg.navItems?.length ? (
//           <nav className="desktop-shell__nav">
//             {cfg.navItems.map((item) => {
//               const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
//               return (
//                 <Link
//                   key={item.path}
//                   to={item.path}
//                   className={`desktop-shell__nav-item ${active ? "is-active" : ""}`}
//                 >
//                   <span className="desktop-shell__nav-icon">{item.icon}</span>
//                   <span className="desktop-shell__nav-label">{item.label}</span>
//                 </Link>
//               );
//             })}
//           </nav>
//         ) : null}
//       </header>

//       <main className="desktop-shell__main">
//         <Outlet />
//       </main>
//     </div>
//   );
// }


// import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Stack, Text } from '../../ui/primitives';
import { APP_NAV_ITEMS } from '../shells/navigation';
import '../shells/DesktopShell.css';


export function DesktopLayout() {
  const location = useLocation();
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
    <div className="desktop-shell" data-shell="desktop">
      {/* Sidebar */}
      <aside className={`desktop-shell__sidebar ${isCollapsed ? 'desktop-shell__sidebar--collapsed' : ''}`}>
        <div className="desktop-shell__brand">
          {!isCollapsed && <Text size="4" weight="semibold">AI Monorepo</Text>}
        </div>
        <nav className="desktop-shell__nav">
          <Stack spacing="1">
            {APP_NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`desktop-shell__nav-item ${isActive ? 'desktop-shell__nav-item--active' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="desktop-shell__nav-icon">{item.icon}</span>
                  {!isCollapsed && <span className="desktop-shell__nav-label">{item.label}</span>}
                </Link>
              );
            })}
          </Stack>
        </nav>
        <button
          className="desktop-shell__toggle"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </aside>

      {/* Main content area */}
      <main className="desktop-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
