import { readStoredSelectedProjectId } from './selectedProject';

const RECENT_PROJECTS_KEY = 'tasks.recentProjectIds';
const RECENT_LIMIT = 8;

export function readRecentProjectIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function rememberRecentProject(projectId: string): void {
  const next = [projectId, ...readRecentProjectIds().filter((id) => id !== projectId)].slice(0, RECENT_LIMIT);
  try {
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Failed to persist recent projects', err);
  }
}

/** Picks first, then the project the Tasks board is filtered to, if it isn't already there. */
export function recentProjectIdsForPicker(): string[] {
  const picks = readRecentProjectIds();
  const boardId = readStoredSelectedProjectId();
  if (boardId && !picks.includes(boardId)) {
    return [...picks, boardId];
  }
  return picks;
}
