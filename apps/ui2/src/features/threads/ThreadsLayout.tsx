import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useThreadsCtx } from "./ThreadsProvider";

export function ThreadsLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useThreadsCtx();

  // No navigation items for threads since it's a simple list + detail view
  const navItems: { path: string; label: string; icon: string }[] = [];

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <DesktopShell
          sectionTitle={sectionTitle}
        >
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Threads"
          sectionTitle={sectionTitle}
          navItems={navItems}
        >
          <Outlet />
        </IosShell>}
    </div>
  );
}
