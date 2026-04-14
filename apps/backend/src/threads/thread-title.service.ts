import { Injectable } from '@nestjs/common';
import { TaskEntity } from '../tasks/task.entity';
import { ChatService } from './chat.service';

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

    const generated = await this.chatService.generateText(prompt);

    if (!generated) {
      return null;
    }

    return this.sanitizeTitle(generated);
  }

  async generateFromParentTask(task: TaskEntity): Promise<string | null> {
    return await this.generateTitle({
      source: 'parent_task',
      content: `Task name: ${task.name}\nTask description: ${task.description}`,
    });
  }

  async generateFromMessage(message: string): Promise<string | null> {
    return await this.generateTitle({
      source: 'first_message',
      content: message.slice(0, 4_000),
    });
  }
}
