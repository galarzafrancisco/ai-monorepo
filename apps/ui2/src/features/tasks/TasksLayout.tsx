import { Outlet, useLocation } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useTasksCtx } from "./TasksProvider";
import { TASKS_STATUS_NAV } from "./const";
import { ShippedCelebration } from "./ShippedCelebration";
import { TasksProjectSelector } from "./TasksProjectSelector";

export function TasksLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle, shippedCelebrationTrigger } = useTasksCtx();
  const location = useLocation();

  const navItems = TASKS_STATUS_NAV.map((item) => ({
    ...item,
    path: `${item.path}${location.search}`,
  }));

  return (
    <div style={{ minHeight: 0 }}>
      <ShippedCelebration trigger={shippedCelebrationTrigger} />
      {isDesktop ?
        <DesktopShell
          sectionTitle={sectionTitle}
          headerRight={<TasksProjectSelector compact />}
        >
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Tasks"
          sectionTitle={sectionTitle}
          navItems={navItems}
        >
          <Outlet />
        </IosShell>}
    </div>
  )
}
