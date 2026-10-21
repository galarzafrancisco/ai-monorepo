import React, { createContext, useContext, useMemo, useState } from 'react';
import { useProjects } from './useProjects';
import type { CreateProjectInput, Project, UpdateProjectInput } from './types';

export type ProjectsContextValue = {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  sectionTitle: string;
  setSectionTitle: (title: string) => void;
  loadProjects: () => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  updateProject: (projectId: string, input: UpdateProjectInput) => Promise<Project>;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { projects, isLoading, error, loadProjects, createProject, updateProject } = useProjects();
  const [sectionTitle, setSectionTitle] = useState('Projects');

  const value = useMemo<ProjectsContextValue>(() => ({
    projects,
    isLoading,
    error,
    sectionTitle,
    setSectionTitle,
    loadProjects,
    createProject,
    updateProject,
  }), [projects, isLoading, error, sectionTitle, loadProjects, createProject, updateProject]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjectsCtx(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjectsCtx must be used within <ProjectsProvider>');
  return ctx;
}
