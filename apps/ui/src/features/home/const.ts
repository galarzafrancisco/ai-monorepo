import { Home, Layers, Puzzle, Settings, UserRound } from "lucide-react";
import { NavegationItem } from "../../shared/types/NavegationItem";

export const HOME_NAVEGATION_ITEMS: NavegationItem[] = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/tasks', label: 'Tasks', icon: Puzzle },
  { path: '/context', label: 'Context', icon: Layers },
  { path: '/agents', label: 'Agents', icon: UserRound },
  { path: '/settings', label: 'Settings', icon: Settings },
]
