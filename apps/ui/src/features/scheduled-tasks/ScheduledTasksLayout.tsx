import { Outlet } from 'react-router-dom';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { DesktopShell } from '../../app/shells/DesktopShell';
import { IosShell } from '../../app/shells/IosShell';
import { useScheduledTasksCtx } from './ScheduledTasksProvider';
import { NavegationItem } from '../../shared/types/NavegationItem';

const SCHEDULED_TASKS_NAV: NavegationItem[] = [
  { path: '/tasks', label: 'Tasks', icon: '🧩' },
  { path: '/tasks/schedule', label: 'Schedules', icon: '🗓' },
];

export function ScheduledTasksLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useScheduledTasksCtx();

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ? (
        <DesktopShell sectionTitle={sectionTitle}>
          <Outlet />
        </DesktopShell>
      ) : (
        <IosShell appTitle="Scheduled" sectionTitle={sectionTitle} navItems={SCHEDULED_TASKS_NAV}>
          <Outlet />
        </IosShell>
      )}
    </div>
  );
}
