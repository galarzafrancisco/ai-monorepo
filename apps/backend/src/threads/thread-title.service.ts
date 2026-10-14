import { Injectable } from '@nestjs/common';
import { TaskEntity } from '../tasks/task.entity';
import { ChatService } from './chat.service';

/**
 * Names threads on the quick tasks model.
 *
 * When quick tasks run on a person's own plan (Sign in with ChatGPT), each
 * call says whose plan pays, and only that person's connection is used:
 * - from the first message: the person who wrote it (they typed, so no extra
 *   consent is needed, as with a conversation turn);
 * - from the parent task: the person who created the thread, as an unattended
 *   call (nobody asked for a title), so only if they allowed task updates on
 *   their plan. An agent creating a subtask has no plan, so it gets no title.
 * Any failure leaves the default title; nothing falls back to another provider.
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
    onBehalfOf: { actorId: string; automated: boolean; description: string };
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

    const generated = await this.chatService.generateText(prompt, {
      onBehalfOf: input.onBehalfOf,
    });

    if (!generated) {
      return null;
    }

    return this.sanitizeTitle(generated);
  }

  /** Title for a thread created for a task. Runs on the thread creator's plan, unattended. */
  async generateFromParentTask(
    task: TaskEntity,
    createdByActorId: string,
  ): Promise<string | null> {
    return await this.generateTitle({
      source: 'parent_task',
      content: `Task name: ${task.name}\nTask description: ${task.description}`,
      onBehalfOf: {
        actorId: createdByActorId,
        automated: true,
        description: 'the person who created this thread',
      },
    });
  }

  /** Title from a thread's first message. Runs on the message author's plan. */
  async generateFromMessage(
    message: string,
    authorActorId: string,
  ): Promise<string | null> {
    return await this.generateTitle({
      source: 'first_message',
      content: message.slice(0, 4_000),
      onBehalfOf: {
        actorId: authorActorId,
        automated: false,
        description: 'the person who wrote the first message',
      },
    });
  }
}
