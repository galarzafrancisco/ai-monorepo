import { Outlet, useParams } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useThreadsCtx } from "./ThreadsProvider";
import { THREADS_NAVEGATION_ITEMS } from "./const";

export function ThreadsLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const { id: threadId } = useParams<{ id?: string }>();
  const isThreadDetailRoute = Boolean(threadId);
  const { sectionTitle, navItems } = useThreadsCtx();

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        isThreadDetailRoute ? (
          <Outlet />
        ) : (
        <DesktopShell
          sectionTitle={sectionTitle}
        >
          <Outlet />
        </DesktopShell>)
        :
        isThreadDetailRoute ? (
          // Thread detail on mobile: bypass IosShell, use custom layout
          <Outlet />
        ) : (
          // Thread list on mobile: use IosShell with bottom nav
          <IosShell
            appTitle="Threads"
            sectionTitle={sectionTitle}
            navItems={navItems}
          >
            <Outlet />
          </IosShell>
        )}
    </div>
  );
}
