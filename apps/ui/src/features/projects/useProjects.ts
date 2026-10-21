import { useCallback, useEffect, useState } from 'react';
import { ProjectsService } from './api';
import type { CreateProjectInput, Project, UpdateProjectInput } from './types';

function sortBySlug(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Pulls the server's error detail out of a failed request. */
export function errorDetail(err: unknown, fallback: string): string {
  const e = err as { body?: { detail?: string }; message?: string } | null;
  return e?.body?.detail || e?.message || fallback;
}

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ProjectsService.ProjectsController_getAllProjects();
      setProjects(sortBySlug(data));
    } catch (err) {
      setError(errorDetail(err, 'Failed to load projects'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  /** Creates a project. Throws on failure so forms can show the reason. */
  const createProject = useCallback(async (input: CreateProjectInput): Promise<Project> => {
    const project = await ProjectsService.ProjectsController_createProject({ body: input });
    setProjects((prev) => sortBySlug([...prev.filter((p) => p.id !== project.id), project]));
    return project;
  }, []);

  /** Updates a project. Throws on failure so forms can show the reason. */
  const updateProject = useCallback(async (projectId: string, input: UpdateProjectInput): Promise<Project> => {
    const project = await ProjectsService.ProjectsController_updateProject({ projectId, body: input });
    setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
    return project;
  }, []);

  return {
    projects,
    isLoading,
    error,
    loadProjects,
    createProject,
    updateProject,
  };
};
