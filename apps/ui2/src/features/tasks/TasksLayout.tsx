import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useTasksCtx } from "./TasksProvider";
import { TASKS_STATUS_NAV } from "./const";
import { ShippedCelebrationOverlay } from "./ShippedCelebrationOverlay";

export function TasksLayout(): JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle, shippedCelebration } = useTasksCtx();

  return (
    <div style={{ minHeight: 0 }}>
      {shippedCelebration && (
        <ShippedCelebrationOverlay key={shippedCelebration.triggeredAt} />
      )}
      {isDesktop ?
        <DesktopShell
          sectionTitle={sectionTitle}
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
