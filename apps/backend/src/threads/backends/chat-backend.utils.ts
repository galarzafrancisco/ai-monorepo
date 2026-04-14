import { ActorEntity } from 'src/identity-provider/actor.entity';

export function formatMessage(message: string, actor: ActorEntity): string {
  return `[${actor.displayName} @${actor.slug}] says:\n${message}`;
}

export function buildThreadScopedInstructions(
  baseInstructions: string,
  threadId: string,
  options?: { useNamespacedToolNames?: boolean },
): string {
  const tasksPrefix = options?.useNamespacedToolNames ? 'mcp__tasks__' : 'tasks__';
  const contextPrefix = options?.useNamespacedToolNames ? 'mcp__context__' : 'context__';

  return `${baseInstructions}

Thread context:
- You are working inside thread ${threadId}.
- This thread coordinates multiple tasks working toward a shared goal.
- Keep your guidance and execution aligned with thread-level context, not just one task.

Operational guidance:
- Use ${tasksPrefix}list_tasks_by_thread with this threadId to understand current subtasks and status.
- Use ${contextPrefix}get_thread_state_memory with this threadId to read current shared state memory.
- When a task or context block becomes relevant to the thread, attach it using ${tasksPrefix}attach_task_to_thread or ${contextPrefix}attach_block_to_thread.
- If a task/block was attached by mistake or is no longer relevant, remove it using ${tasksPrefix}detach_task_from_thread or ${contextPrefix}detach_block_from_thread.
- During conversation, when you discover durable cross-task decisions/constraints/risks, update memory via ${contextPrefix}update_block.
- If the user asks for updates on a given task, read the task and the memory block to update the user.
- Only write durable shared memory (not ephemeral chat details).`;
}
