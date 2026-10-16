import { NavegationItem } from "../types/NavegationItem";
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  FolderKanban,
  Home,
  Layers,
  ListCheck,
  Lock,
  MessageSquare,
  MessagesSquare,
  PocketKnife,
  Puzzle,
  Settings,
  Squirrel,
  StickyNote,
  UserRound,
  Zap,
} from "lucide-react";

export const MAIN_NAVEGATION_ITEMS: NavegationItem[] = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/threads', label: 'Threads', icon: MessagesSquare },
  { path: '/tasks', label: 'Tasks', icon: ClipboardCheck },
  { path: '/context', label: 'Context', icon: Layers },
  // Schedules lives under Context in the sidebar, but its route is still a
  // view inside Tasks (/tasks/schedule). Active-state highlighting uses the
  // longest matching path, so ordering does not affect which item is active.
  { path: '/tasks/schedule', label: 'Schedules', icon: CalendarDays },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/tools', label: 'Tools', icon: PocketKnife },
  { path: '/agents', label: 'Agents', icon: Squirrel },
  { path: '/runs', label: 'Runs', icon: Zap },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/logout', label: 'Logout', icon: Lock },
];
