import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useTasksCtx } from "./TasksProvider";
import { TASKS_STATUS_NAV } from "./const";

export function TasksLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle } = useTasksCtx();

  console.log('Tasks layout mounting');

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
          navItems={TASKS_STATUS_NAV}
        >
          <Outlet />
        </IosShell>}
    </div>
  )
}
