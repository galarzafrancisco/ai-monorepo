import { Injectable } from '@nestjs/common';
import { AiModelJob } from 'src/ai-providers/enums';
import { ActorType } from 'src/identity-provider/enums';
import { TaskEntity } from '../tasks/task.entity';
import { ChatService, SmallTaskRunFor } from './chat.service';

/** The actor whose action asked for a title. */
export type TitleTrigger = { id: string; type: ActorType };

/**
 * Names threads on a small tasks model. Which one depends on who triggered it:
 * - a person (creating a thread, or writing its first message): user small
 *   tasks. On a person's own plan (Sign in with ChatGPT) that person's plan
 *   pays, as for a message they wrote; nobody else's.
 * - an agent (e.g. creating a subtask, which creates the parent's thread):
 *   system small tasks, which only run on a provider with an API key.
 * A failure leaves the default title and is logged by ChatService; nothing
 * falls back to another provider or job.
 */
@Injectable()
export class ThreadTitleService {
  private static readonly MAX_TITLE_LENGTH = 80;

  constructor(private readonly chatService: ChatService) {}

  private sanitizeTitle(title: string): string | null {
    const sanitized = title
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ');

    if (!sanitized) {
      return null;
    }

    if (sanitized.length <= ThreadTitleService.MAX_TITLE_LENGTH) {
      return sanitized;
    }

    return sanitized.slice(0, ThreadTitleService.MAX_TITLE_LENGTH).trimEnd();
  }

  private async generateTitle(input: {
    source: 'parent_task' | 'first_message';
    content: string;
    trigger: TitleTrigger;
    /** Who the trigger is, for error messages. */
    description: string;
  }): Promise<string | null> {
    const prompt = `Generate a concise title for a conversation thread.

Requirements:
- 3 to 8 words
- no quotes
- no trailing punctuation
- title only, nothing else

Source: ${input.source}
Content:
${input.content}`;

    const generated = await this.chatService.generateText(
      prompt,
      ThreadTitleService.runFor(input.trigger, input.description),
    );

    if (!generated) {
      return null;
    }

    return this.sanitizeTitle(generated);
  }

  /** Only a person triggers user small tasks; anything else is system work. */
  private static runFor(trigger: TitleTrigger, description: string): SmallTaskRunFor {
    if (trigger.type !== ActorType.HUMAN) {
      return { job: AiModelJob.SYSTEM_SMALL_TASKS };
    }
    return {
      job: AiModelJob.USER_SMALL_TASKS,
      onBehalfOf: { actorId: trigger.id, automated: false, description },
    };
  }

  /** Title for a thread created for a task, from the parent task. */
  async generateFromParentTask(
    task: TaskEntity,
    createdBy: TitleTrigger,
  ): Promise<string | null> {
    return await this.generateTitle({
      source: 'parent_task',
      content: `Task name: ${task.name}\nTask description: ${task.description}`,
      trigger: createdBy,
      description: 'the person who created this thread',
    });
  }

  /** Title from a thread's first message. */
  async generateFromMessage(
    message: string,
    author: TitleTrigger,
  ): Promise<string | null> {
    return await this.generateTitle({
      source: 'first_message',
      content: message.slice(0, 4_000),
      trigger: author,
      description: 'the person who wrote the first message',
    });
  }
}
