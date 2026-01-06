import type { InAppNavigation } from '../../shared/navigation';

export const taskerooNavigation: InAppNavigation = {
  items: [
    { path: '/taskeroo/not-started', label: 'Not Started', icon: '○' },
    { path: '/taskeroo/in-progress', label: 'In Progress', icon: '◐' },
    { path: '/taskeroo/in-review', label: 'In Review', icon: '👀' },
    { path: '/taskeroo/done', label: 'Done', icon: '✓' },
  ],
};
