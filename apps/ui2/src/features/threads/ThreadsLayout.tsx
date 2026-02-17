import { Outlet, useParams } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useThreadsCtx } from "./ThreadsProvider";
import { THREADS_NAVEGATION_ITEMS } from "./const";

export function ThreadsLayout(): JSX.Element {
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
