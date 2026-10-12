import { Injectable } from '@nestjs/common';
import { tool, ToolSet } from 'ai';
import { z } from 'zod/v3';
import { ThreadTaskSubscriptionsService } from '../task-subscriptions/thread-task-subscriptions.service';
import {
  STAY_SILENT_TOOL,
  SUBSCRIBE_TO_TASK_TOOL,
  UNSUBSCRIBE_FROM_TASK_TOOL,
} from './thread-agent.prompts';

/**
 * Tools that only make sense inside a thread, so they are bound to the thread
 * the turn runs on instead of being exposed over MCP.
 */
@Injectable()
export class ThreadAgentToolsFactory {
  constructor(private readonly subscriptions: ThreadTaskSubscriptionsService) {}

  build(input: {
    threadId: string;
    agentActorId: string;
    /** Who the turn is answering. */
    forActorId: string;
  }): ToolSet {
    const { threadId, agentActorId, forActorId } = input;

    return {
      [SUBSCRIBE_TO_TASK_TOOL]: tool({
        description:
          'Get notified in this thread when a task is in review or done. Use it when the user is waiting on the result of a task or the result matters to the conversation.',
        inputSchema: z.object({
          taskId: z.string(),
          waitingFor: z
            .string()
            .describe('What the user wants from this task, in one sentence. You get it back with the notification.'),
        }),
        execute: async ({ taskId, waitingFor }) => {
          const task = await this.subscriptions.subscribe({
            threadId,
            taskId,
            forActorId,
            waitingFor,
          });
          return task
            ? `Subscribed. Task "${task.name}" is currently ${task.status}.`
            : `Task ${taskId} not found.`;
        },
      }),
      [UNSUBSCRIBE_FROM_TASK_TOOL]: tool({
        description: 'Stop being notified about a task in this thread.',
        inputSchema: z.object({ taskId: z.string() }),
        execute: async ({ taskId }) => {
          const removed = await this.subscriptions.unsubscribe({
            threadId,
            taskId,
            actorId: agentActorId,
          });
          return removed ? 'Unsubscribed.' : 'This thread was not subscribed to that task.';
        },
      }),
      [STAY_SILENT_TOOL]: tool({
        description:
          'End your turn without sending a message. Use it for system events, such as a task notification, that do not warrant a response to the user. Never use it to ignore something the user said.',
        inputSchema: z.object({}),
        execute: async () => 'Turn ended without a message.',
      }),
    };
  }
}
