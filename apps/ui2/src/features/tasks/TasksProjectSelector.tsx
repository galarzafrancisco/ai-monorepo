import { useMemo } from 'react';
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

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.slug.localeCompare(b.slug)),
    [projects],
  );

  return (
    <label className={`tasks-project-selector ${compact ? 'tasks-project-selector--compact' : ''}`}>
      <span className="tasks-project-selector__label">Project</span>
      <select
        className="tasks-project-selector__select"
        value={selectedProjectId ?? ''}
        onChange={(event) => setSelectedProjectId(event.target.value || null)}
        disabled={isLoadingProjects}
      >
        <option value="">All projects</option>
        {sortedProjects.map((project) => (
          <option key={project.id} value={project.slug}>
            {project.slug}
          </option>
        ))}
      </select>
    </label>
  );
}
