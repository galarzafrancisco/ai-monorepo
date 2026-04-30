import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, FolderKanban, GitBranch, LayoutDashboard } from "lucide-react";
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
  const [activeScheduleCount, setActiveScheduleCount] = useState<number | null>(null);
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
    <ProjectSelector
      projects={projects}
      projectsLoaded={projectsLoaded}
      selectedProjectId={selectedProjectId}
      onChange={setSelectedProjectId}
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
          titleAccessory={showProjectSelector ? projectSelector : undefined}
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

function ProjectSelector({
  projects,
  projectsLoaded,
  selectedProjectId,
  onChange,
}: {
  projects: Array<{ id: string; slug: string; tagName: string }>;
  projectsLoaded: boolean;
  selectedProjectId: string | null;
  onChange: (projectId: string | null) => void;
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    if (!normalizedQuery) {
      return projects;
    }
    return projects.filter((project) =>
      project.slug.toLowerCase().includes(normalizedQuery) ||
      project.tagName.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, projects]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const selectProject = (projectId: string | null) => {
    onChange(projectId);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="tasks-layout__project-selector" ref={rootRef}>
      <button
        className="tasks-layout__project-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Task project"
        disabled={!projectsLoaded}
        onClick={() => setIsOpen((current) => !current)}
      >
        <FolderKanban className="tasks-layout__project-selector-icon" size={15} strokeWidth={1.75} absoluteStrokeWidth />
        <span className="tasks-layout__project-trigger-label">
          {selectedProject?.slug ?? "All projects"}
        </span>
        <ChevronDown
          className={`tasks-layout__project-selector-chevron${isOpen ? " tasks-layout__project-selector-chevron--open" : ""}`}
          size={14}
          strokeWidth={1.75}
          absoluteStrokeWidth
        />
      </button>

      {isOpen ? (
        <div className="tasks-layout__project-menu">
          <input
            ref={searchInputRef}
            className="tasks-layout__project-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
          />
          <div className="tasks-layout__project-options" role="listbox" aria-label="Task project">
            <button
              className={`tasks-layout__project-option${selectedProjectId === null ? " tasks-layout__project-option--selected" : ""}`}
              type="button"
              role="option"
              aria-selected={selectedProjectId === null}
              onClick={() => selectProject(null)}
            >
              All projects
            </button>
            {filteredProjects.length === 0 ? (
              <div className="tasks-layout__project-empty">No matching projects</div>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  className={`tasks-layout__project-option${selectedProjectId === project.id ? " tasks-layout__project-option--selected" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={selectedProjectId === project.id}
                  onClick={() => selectProject(project.id)}
                >
                  <span className="tasks-layout__project-option-name">{project.slug}</span>
                  <span className="tasks-layout__project-option-tag">{project.tagName}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
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
