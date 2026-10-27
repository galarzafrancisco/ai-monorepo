import { GitBranch, LayoutDashboard } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { useTasksCtx } from "./TasksProvider";
import { TASKS_STATUS_NAV } from "./const";
import { ShippedCelebration } from "./ShippedCelebration";
import { ProjectPicker } from "../projects/ProjectPicker";
import "./TasksLayout.css";

export function TasksLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const {
    sectionTitle,
    shippedCelebrationTrigger,
    projects,
    projectsLoaded,
    selectedProjectId,
    setSelectedProjectId,
  } = useTasksCtx();
  const navigate = useNavigate();
  const location = useLocation();
  const isDependencyView = location.pathname === "/tasks/dependencies" || location.pathname.startsWith("/tasks/dependencies/");
  const isBoardView = [
    "/tasks/not-started",
    "/tasks/in-progress",
    "/tasks/in-review",
    "/tasks/done",
  ].includes(location.pathname);
  const showViewToggle = isBoardView || isDependencyView;
  const showProjectSelector = isBoardView || isDependencyView;
  const viewToggle = (
    <TaskViewToggle
      isBoardView={isBoardView}
      isDependencyView={isDependencyView}
      onBoardClick={() => navigate('/tasks/not-started')}
      onDependenciesClick={() => navigate('/tasks/dependencies')}
    />
  );
  const projectSelector = (
    <ProjectPicker
      projects={projects}
      projectsLoaded={projectsLoaded}
      selectedProjectId={selectedProjectId}
      onChange={setSelectedProjectId}
      emptyLabel="All projects"
      ariaLabel="Task project"
    />
  );

  return (
    <div style={{ minHeight: 0 }}>
      <ShippedCelebration trigger={shippedCelebrationTrigger} />
      {isDesktop ?
        <DesktopShell
          sectionTitle={sectionTitle}
          titleAccessory={showProjectSelector ? projectSelector : undefined}
          headerActions={(
            <div className="tasks-layout__header-actions">
              {showViewToggle ? viewToggle : null}
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
          topActions={showProjectSelector || showViewToggle ? (
            <div className="tasks-layout__mobile-top-actions">
              {showProjectSelector ? projectSelector : null}
              {showViewToggle ? <div className="tasks-layout__mobile-view-toggle">{viewToggle}</div> : null}
            </div>
          ) : undefined}
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
