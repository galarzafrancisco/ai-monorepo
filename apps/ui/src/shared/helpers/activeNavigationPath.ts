import type { NavegationItem } from "../types/NavegationItem";

function matchesPath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(itemPath + '/');
}

/**
 * Returns the path of the navigation item that should be highlighted for the
 * given location, or null when none matches.
 *
 * Matching is segment-aware (`/tasks` does not match `/tasksomething`) and the
 * most specific item wins, so nested items such as `/tasks/schedule` do not
 * also highlight their parent `/tasks`.
 */
export function getActiveNavigationPath(
  pathname: string,
  items: Pick<NavegationItem, 'path'>[],
): string | null {
  let activePath: string | null = null;
  for (const item of items) {
    if (!matchesPath(pathname, item.path)) continue;
    if (activePath === null || item.path.length > activePath.length) {
      activePath = item.path;
    }
  }
  return activePath;
}
