import { InAppNavItem } from "src/shared/navigation";

// shell.types.ts
export interface NavItem {
  label: string;
  icon: string;  // keep string for now, can evolve to ReactNode later
  path: string;
}

export interface ShellConfig {
  appTitle: string;
  sectionTitle?: string;
  navItems?: InAppNavItem[];
  // future: headerRight, actions, backBehavior, etc.
}

export type ShellConfigPatch = Partial<ShellConfig>;

export const DEFAULT_SHELL_CONFIG: ShellConfig = {
  appTitle: "AI Monorepo",
  sectionTitle: "",
  navItems: [],
};

