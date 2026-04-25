import { NavegationItem } from "../types/NavegationItem";
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
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
  { path: '/tasks', label: 'Tasks', icon: ClipboardCheck },
  { path: '/tasks/schedule', label: 'Schedules', icon: CalendarDays },
  { path: '/context', label: 'Context', icon: Layers },
  { path: '/agents', label: 'Agents', icon: Squirrel },
  { path: '/threads', label: 'Threads', icon: MessagesSquare },
  { path: '/tools', label: 'Tools', icon: PocketKnife },
  { path: '/runs', label: 'Runs', icon: Zap },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/logout', label: 'Logout', icon: Lock },
];
