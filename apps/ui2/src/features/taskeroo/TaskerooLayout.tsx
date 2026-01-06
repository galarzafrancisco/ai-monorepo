import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Stack, Text, Tabs } from '../../ui/primitives';
import { useInAppNav } from '../../app/providers';
import { taskerooNavigation } from './navigation';
import './TaskerooLayout.css';

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
    <Stack spacing="5">
      <Stack spacing="2">
        <Text size="6" weight="bold">Taskeroo</Text>
        <Text tone="muted">Manage your tasks and track progress</Text>
      </Stack>

      {/* In-app navigation - desktop only */}
      <div className="taskeroo-tabs--desktop">
        <Tabs items={taskerooNavigation.items} />
      </div>

      {/* Routed content */}
      <Outlet />
    </Stack>
  );
}
