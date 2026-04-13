import { useEffect, useState } from 'react';
import { WalkthroughService } from './api';

export type WalkthroughStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
};

export type WalkthroughStatus = {
  steps: WalkthroughStep[];
  completedCount: number;
  totalCount: number;
  displayMode: string | null;
};

export function useWalkthrough() {
  const [status, setStatus] = useState<WalkthroughStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    WalkthroughService.WalkthroughController_getStatus()
      .then((data) => {
        const steps: WalkthroughStep[] = [
          {
            id: 'worker',
            label: 'Configure a worker',
            description:
              'A worker is a process that runs on your machine and executes agent tasks. Launch the Taico worker binary, then authenticate it with your account — it will appear here once connected.',
            href: '/settings/workers',
            completed: data.workerConfigured,
          },
          {
            id: 'agent',
            label: 'Create an agent',
            description:
              'Agents are AI assistants that work on tasks. Create one by picking a runner (e.g. Claude Code, OpenCode), choosing a template, and selecting which tools it can use.',
            href: '/agents',
            completed: data.agentCreated,
          },
          {
            id: 'task',
            label: 'Create a task',
            description:
              'Tasks are the core unit of work in Taico. Create your first task, write a clear description, and assign it to an agent to get it working.',
            href: '/tasks',
            completed: data.taskCreated,
          },
          {
            id: 'project-create',
            label: 'Create a project',
            description:
              'Projects are created automatically when you add a tag in the format project:<name> to any task. Go to Tasks, open or create a task, and add a tag like project:my-app. Taico will create the project entry for you.',
            href: '/tasks',
            completed: data.projectCreated,
          },
          {
            id: 'project-configure',
            label: 'Configure a project',
            description:
              'Link your project to a code repository. Go to Settings → Projects, find your project, and add a repository URL. Taico will automatically clone that repo for any task tagged with this project — no need to specify it per-task.',
            href: '/settings/projects',
            completed: data.projectConfigured,
          },
          {
            id: 'task-with-project',
            label: 'Assign a task to an agent with a project',
            description:
              'Tag a task with a project tag and assign it to an agent. Taico will clone the linked repository and make it available in the agent\'s working directory automatically.',
            href: '/tasks',
            completed: data.taskWithProjectCreated,
          },
          {
            id: 'context',
            label: 'Create a context block',
            description:
              'Context blocks are reusable pieces of text — instructions, reference docs, coding standards — that you can attach to tasks and threads. Agents will read them as part of their prompt.',
            href: '/context',
            completed: data.contextBlockCreated,
          },
          {
            id: 'thread',
            label: 'Configure threads',
            description:
              'Threads coordinate parallel work when a task branches into sub-tasks. They are created automatically when a task spawns children. Explore the Threads section to see how work is organized.',
            href: '/settings/chat',
            completed: data.threadConfigured,
          },
        ];

        const completedCount = steps.filter((s) => s.completed).length;
        setStatus({
          steps,
          completedCount,
          totalCount: steps.length,
          displayMode: data.onboardingDisplayMode,
        });
      })
      .catch((err) => {
        console.error('Failed to fetch walkthrough status:', err);
        setError(err instanceof Error ? err.message : 'Failed to load walkthrough');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { status, isLoading, error };
}
