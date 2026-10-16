import { Outlet } from 'react-router-dom';
import { useIsDesktop } from '../../app/hooks/useIsDesktop';
import { DesktopShell } from '../../app/shells/DesktopShell';
import { IosShell } from '../../app/shells/IosShell';
import { useProjectsCtx } from './ProjectsProvider';

export function ProjectsLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useProjectsCtx();

  // Projects is a list + detail view, so there is no section navigation.
  const navItems: { path: string; label: string; icon: string }[] = [];

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ? (
        <DesktopShell sectionTitle={sectionTitle}>
          <Outlet />
        </DesktopShell>
      ) : (
        <IosShell appTitle="Projects" sectionTitle={sectionTitle} navItems={navItems}>
          <Outlet />
        </IosShell>
      )}
    </div>
  );
}
