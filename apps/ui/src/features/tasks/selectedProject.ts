/**
 * The project the Tasks board is filtered to, kept in localStorage so the
 * choice survives reloads and can be set from outside the board (for
 * example, "Open in Tasks" on a project page).
 */
export const SELECTED_PROJECT_STORAGE_KEY = 'tasks.selectedProjectId';

export function readStoredSelectedProjectId(): string | null {
  try {
    return localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Saves (or clears, with null) the project the Tasks board shows. */
export function storeSelectedProjectId(projectId: string | null): void {
  try {
    if (projectId) {
      localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, projectId);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to persist selected task project', err);
  }
}
