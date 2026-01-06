import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Stack, Text } from '../../ui/primitives';
import { useInAppNav } from '../../app/providers';
import { taskerooNavigation } from './navigation';
import { TaskerooProvider, useTaskerooCtx } from './TaskerooProvider';
import { TaskerooDesktopView } from './TaskerooDesktopView';
import './TaskerooLayout.css';
import { ErrorText } from '../../ui/primitives/ErrorText';

function TaskerooConnectionHeader() {
  const { isConnected } = useTaskerooCtx();
  return  isConnected || <ErrorText>Disconnected</ErrorText>
}

export function TaskerooLayout() {
  const { setInAppNav } = useInAppNav();

  useEffect(() => {
    // Register in-app navigation when this layout mounts
    setInAppNav(taskerooNavigation);

    // Clean up when unmounting
    return () => {
      setInAppNav(null);
    };
  }, [setInAppNav]);

  return (
    <TaskerooProvider>
      {/* Desktop view - shows board/list toggle */}
      <div className="taskeroo-layout--desktop">
        <TaskerooDesktopView />
      </div>

      {/* Mobile view - shows routed content (tabs are in bottom nav) */}
      <div className="taskeroo-layout--mobile">
        <Stack spacing="5">
          <Stack spacing="2">
            <Text size="6" weight="bold">Taskeroo</Text>
            <TaskerooConnectionHeader />
            <Text tone="muted">Manage your tasks and track progress</Text>
          </Stack>

          {/* Routed content */}
          <Outlet />
        </Stack>
      </div>
    </TaskerooProvider>
  );
}
