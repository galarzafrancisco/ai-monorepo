import { Outlet } from 'react-router-dom';
import { TaskerooProvider } from './TaskerooProvider';
import { TaskerooDesktopView } from './TaskerooDesktopView';
import './TaskerooLayout.css';
import { useSetShellConfig } from '../../app/hooks/useSetShellConfig';
import { STATUS_CONFIG } from './const';

export function TaskerooLayout() {

  useSetShellConfig({
    appTitle: "Taskeroo",
    navItems: Object.entries(STATUS_CONFIG).map(([key, value]) => value),
  });

  return (
    <TaskerooProvider>
      {/* Desktop view - shows board/list toggle */}
      <div className="taskeroo-layout--desktop">
        <TaskerooDesktopView />
      </div>

      {/* Mobile view - shows routed content (tabs are in bottom nav) */}
      <div className="taskeroo-layout--mobile">
        {/* Routed content */}
        <Outlet />
      </div>
    </TaskerooProvider>
  );
}
