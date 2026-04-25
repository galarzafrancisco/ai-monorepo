import { Home, Layers, Puzzle } from "lucide-react";
import { NavegationItem } from "../../shared/types/NavegationItem";

export const THREADS_NAVEGATION_ITEMS: NavegationItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/tasks', label: 'Tasks', icon: Puzzle },
  { path: '/context', label: 'Context', icon: Layers },
]

export function ThreadNavItemsForThreadId(threadId: string) {
  return THREADS_NAVEGATION_ITEMS.map(item => {
    return {...item, path: `/threads/${threadId}${item.path}`}
  })
}
