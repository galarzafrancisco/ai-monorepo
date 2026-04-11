import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useTasksCtx } from "./TasksProvider";
import { TASKS_STATUS_NAV } from "./const";
import { ShippedCelebration } from "./ShippedCelebration";
import { Button } from "../../ui/primitives";
import { ScheduledTasksService } from "../scheduled-tasks/api";
import type { ScheduledTaskResponseDto } from "@taico/client/v2";
import "./TasksLayout.css";

export function TasksLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const { sectionTitle, shippedCelebrationTrigger } = useTasksCtx();
  const navigate = useNavigate();
  const [activeScheduleCount, setActiveScheduleCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadCount = async () => {
      try {
        const response = await ScheduledTasksService.ScheduledTasksController_listScheduledTasks({ page: 1, limit: 50 });
        if (!isMounted) {
          return;
        }
        const active = response.items.filter((task: ScheduledTaskResponseDto) => task.enabled).length;
        setActiveScheduleCount(active);
      } catch {
        if (isMounted) {
          setActiveScheduleCount(null);
        }
      }
    };
    loadCount();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ minHeight: 0 }}>
      <ShippedCelebration trigger={shippedCelebrationTrigger} />
      {isDesktop ?
        <DesktopShell
          sectionTitle={sectionTitle}
          headerActions={(
            <Button
              size="sm"
              variant="ghost"
              className="tasks-layout__schedule-button"
              onClick={() => navigate('/tasks/schedule')}
            >
              <span className="tasks-layout__schedule-icon">🗓</span>
              Schedule
              {activeScheduleCount && activeScheduleCount > 0 ? (
                <span className="tasks-layout__schedule-badge">{activeScheduleCount}</span>
              ) : null}
            </Button>
          )}
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
