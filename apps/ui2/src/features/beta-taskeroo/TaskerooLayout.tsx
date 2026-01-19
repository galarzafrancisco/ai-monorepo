import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useTaskerooCtx } from "./TaskerooProvider";
import { TASKEROO_STATUS_NAV } from "./const";

export function TaskerooLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useTaskerooCtx();

  console.log('Taskeroo layout mounting');

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <DesktopShell
          sectionTitle="Tasks"
        >
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Tasks"
          sectionTitle={sectionTitle}
          navItems={TASKEROO_STATUS_NAV}
        >
          <Outlet />
        </IosShell>}
    </div>
  )
}
