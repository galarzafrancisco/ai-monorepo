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
  // Schedules is a view inside Tasks (/tasks/schedule), so it stays next to it.
  { path: '/tasks/schedule', label: 'Schedules', icon: CalendarDays },
  { path: '/context', label: 'Context', icon: Layers },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/tools', label: 'Tools', icon: PocketKnife },
  { path: '/agents', label: 'Agents', icon: Squirrel },
  { path: '/runs', label: 'Runs', icon: Zap },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/logout', label: 'Logout', icon: Lock },
];
