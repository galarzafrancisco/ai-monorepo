import { NavegationItem } from "../../shared/types/NavegationItem";

export const THREADS_NAVEGATION_ITEMS: NavegationItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { path: '/tasks', label: 'Tasks', icon: '🧩' },
  { path: '/context', label: 'Context', icon: '🧱' },
]

export function ThreadNavItemsForThreadId(threadId: string) {
  return THREADS_NAVEGATION_ITEMS.map(item => {
    return {...item, path: `/threads/${threadId}${item.path}`}
  })
}