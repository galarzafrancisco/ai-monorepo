/**
 * Navigation contract system
 * Allows features to declare their in-app navigation to the shell
 */

export interface InAppNavItem {
  path: string;
  label: string;
  icon?: string;
}

export interface InAppNavigation {
  items: InAppNavItem[];
}
