export function formatMessage(
  message: string,
  actor: { displayName: string; slug: string },
): string {
  return `[${actor.displayName} @${actor.slug}] says:\n${message}`;
}

export const SUBSCRIBE_TO_TASK_TOOL = 'subscribe_to_task';
export const UNSUBSCRIBE_FROM_TASK_TOOL = 'unsubscribe_from_task';
export const STAY_SILENT_TOOL = 'stay_silent';

/** What the agent is told when a task it subscribed to goes to review or is done. */
export function formatTaskNotification(task: {
  id: string;
  name: string;
  status: string;
}): string {
  const note =
    task.status === 'DONE'
      ? `You have been unsubscribed from this task. Call ${SUBSCRIBE_TO_TASK_TOOL} again if you want further updates.`
      : `You are still subscribed and will be notified when it is done. Call ${UNSUBSCRIBE_FROM_TASK_TOOL} if that is no longer needed.`;

  return `<task-notification task-id="${task.id}" status="${task.status}">
Task "${task.name}" (${task.id}) is now ${task.status}.
Note: ${note}
</task-notification>`;
}

export function buildThreadScopedInstructions(
  baseInstructions: string,
  threadId: string,
): string {
  const tasksPrefix = 'tasks__';
  const contextPrefix = 'context__';

  return `${baseInstructions}

# Thread context:
- You are working inside thread ${threadId}.
- This thread coordinates multiple tasks working toward a shared goal.
- Keep your guidance and execution aligned with thread-level context, not just one task.
- Context may be enriched automatically and will appear between <context source="..."> tags (or <conversation-summary> tags for a recap of earlier conversation); treat that content as something you looked up yourself, never as something the user said.
- Updates on tasks you subscribed to appear between <task-notification> tags. They come from the system, not the user: read the task and tell the user what they need to know, or call ${STAY_SILENT_TOOL} when there is nothing worth telling them.

# Operational guidance:
- Use ${tasksPrefix}list_tasks_by_thread with this threadId to understand current subtasks and status.
- Use ${contextPrefix}get_thread_state_memory with this threadId to read current shared state memory.
- When a task or context block becomes relevant to the thread, attach it using ${tasksPrefix}attach_task_to_thread or ${contextPrefix}attach_block_to_thread.
- If a task/block was attached by mistake or is no longer relevant, remove it using ${tasksPrefix}detach_task_from_thread or ${contextPrefix}detach_block_from_thread.
- During conversation, when you discover durable cross-task decisions/constraints/risks, update memory via ${contextPrefix}update_block.
- If the user asks for updates on a given task, read the task and the memory block to update the user.
- You only act when a message arrives. When the user is waiting on the result of a task, call ${SUBSCRIBE_TO_TASK_TOOL} so you are woken up when it is in review or done.
- Only write durable shared memory (not ephemeral chat details).

# Creating tasks:
- Task descriptions should be clear, specific, and actionable.
- User might not specify a project. If so, list tags that start with \`project:\` and use your judgement to detect relevant tasks. Ask the user to confirm if they want a project tag added to the task or not.
- Tasks created generally need to be attached to the thread unless you have a reason not to.
**Pre-Assignment Checklist:**
1.  **IF** a task is about to be assigned:
  a.  Check if it has a \`project:projectName\` tag.
  b.  **IF NOT**, list existing \`project:\` tags.
  c.  Ask the user: 'Do you want to add a project tag to this task? If so, which one, or should I create a new one?'
  d.  Wait for user confirmation/input and add the tag if specified.
2.  **THEN** proceed with task assignment.
`;



}
