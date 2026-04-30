import { useEffect, useState } from "react";
import { CalendarDays, GitBranch, LayoutDashboard } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const [activeScheduleCount, setActiveScheduleCount] = useState<number | null>(null);
  const isDependencyView = location.pathname === "/tasks/dependencies" || location.pathname.startsWith("/tasks/dependencies/");
  const isBoardView = [
    "/tasks/not-started",
    "/tasks/in-progress",
    "/tasks/in-review",
    "/tasks/done",
  ].includes(location.pathname);
  const showViewToggle = isBoardView || isDependencyView;
  const viewToggle = (
    <TaskViewToggle
      isBoardView={isBoardView}
      isDependencyView={isDependencyView}
      onBoardClick={() => navigate('/tasks/not-started')}
      onDependenciesClick={() => navigate('/tasks/dependencies')}
    />
  );

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
            <div className="tasks-layout__header-actions">
              {showViewToggle ? viewToggle : null}
              <Button
                size="sm"
                variant="ghost"
                className="tasks-layout__header-button"
                onClick={() => navigate('/tasks/schedule')}
              >
                <CalendarDays className="tasks-layout__header-icon" size={16} strokeWidth={1.5} absoluteStrokeWidth />
                Schedule
                {activeScheduleCount && activeScheduleCount > 0 ? (
                  <span className="tasks-layout__schedule-badge">{activeScheduleCount}</span>
                ) : null}
              </Button>
            </div>
          )}
        >
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Tasks"
          sectionTitle={sectionTitle}
          navItems={TASKS_STATUS_NAV}
          topActions={showViewToggle ? <div className="tasks-layout__mobile-view-toggle">{viewToggle}</div> : undefined}
        >
          <Outlet />
        </IosShell>}
    </div>
  )
}

function TaskViewToggle({
  isBoardView,
  isDependencyView,
  onBoardClick,
  onDependenciesClick,
}: {
  isBoardView: boolean;
  isDependencyView: boolean;
  onBoardClick: () => void;
  onDependenciesClick: () => void;
}): React.JSX.Element {
  return (
    <div className="tasks-layout__view-toggle" role="group" aria-label="Task view">
      <button
        className={`tasks-layout__view-toggle-button${isBoardView ? " tasks-layout__view-toggle-button--active" : ""}`}
        type="button"
        aria-pressed={isBoardView}
        onClick={onBoardClick}
      >
        <LayoutDashboard className="tasks-layout__header-icon" size={16} strokeWidth={1.5} absoluteStrokeWidth />
        Board
      </button>
      <button
        className={`tasks-layout__view-toggle-button${isDependencyView ? " tasks-layout__view-toggle-button--active" : ""}`}
        type="button"
        aria-pressed={isDependencyView}
        onClick={onDependenciesClick}
      >
        <GitBranch className="tasks-layout__header-icon" size={16} strokeWidth={1.5} absoluteStrokeWidth />
        Dependencies
      </button>
    </div>
  );
}
