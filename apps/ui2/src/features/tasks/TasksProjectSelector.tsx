import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTasksCtx } from './TasksProvider';
import './TasksProjectSelector.css';

type TasksProjectSelectorProps = {
  compact?: boolean;
};

export function TasksProjectSelector({ compact = false }: TasksProjectSelectorProps): JSX.Element {
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    isLoadingProjects,
  } = useTasksCtx();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const valueId = useId();

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.slug.localeCompare(b.slug)),
    [projects],
  );

  const selectedProject = sortedProjects.find((project) => project.slug === selectedProjectId) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = normalizedQuery
    ? sortedProjects.filter((project) => project.slug.toLowerCase().includes(normalizedQuery))
    : sortedProjects;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const selectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div
      className={`tasks-project-selector ${compact ? 'tasks-project-selector--compact' : ''}`}
      ref={containerRef}
    >
      <span className="tasks-project-selector__label" id={labelId}>Project</span>
      <button
        type="button"
        className="tasks-project-selector__trigger"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isLoadingProjects}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${labelId} ${valueId}`}
      >
        <span className="tasks-project-selector__icon" aria-hidden="true">P</span>
        <span className="tasks-project-selector__value" id={valueId}>
          {selectedProject?.slug ?? 'All projects'}
        </span>
        <span className="tasks-project-selector__chevron" aria-hidden="true">v</span>
      </button>
      {isOpen ? (
        <div className="tasks-project-selector__popover">
          <input
            ref={inputRef}
            className="tasks-project-selector__search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
          />
          <div className="tasks-project-selector__list" role="listbox" aria-label="Task project">
            <button
              type="button"
              className={`tasks-project-selector__option ${selectedProjectId === null ? 'tasks-project-selector__option--selected' : ''}`}
              onClick={() => selectProject(null)}
              role="option"
              aria-selected={selectedProjectId === null}
            >
              All projects
            </button>
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={`tasks-project-selector__option ${selectedProjectId === project.slug ? 'tasks-project-selector__option--selected' : ''}`}
                onClick={() => selectProject(project.slug)}
                role="option"
                aria-selected={selectedProjectId === project.slug}
              >
                {project.slug}
              </button>
            ))}
            {filteredProjects.length === 0 ? (
              <div className="tasks-project-selector__empty">No projects found</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
