import { NavegationItem } from "../types/NavegationItem";
import {
  BriefcaseBusiness,
  CalendarDays,
  Home,
  Layers,
  Lock,
  MessageSquare,
  Puzzle,
  Settings,
  UserRound,
  Zap,
} from "lucide-react";

export const MAIN_NAVEGATION_ITEMS: NavegationItem[] = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/tasks', label: 'Tasks', icon: Puzzle },
  { path: '/tasks/schedule', label: 'Schedules', icon: CalendarDays },
  { path: '/context', label: 'Context', icon: Layers },
  { path: '/agents', label: 'Agents', icon: UserRound },
  { path: '/threads', label: 'Threads', icon: MessageSquare },
  { path: '/tools', label: 'Tools', icon: BriefcaseBusiness },
  { path: '/runs', label: 'Runs', icon: Zap },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/logout', label: 'Logout', icon: Lock },
];
