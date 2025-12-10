import { Injectable, Logger } from '@nestjs/common';
import ollama from 'ollama';

@Injectable()
export class LlmHelperService {
  private readonly logger = new Logger(LlmHelperService.name);
  private readonly model = 'qwen2.5:0.5b';

  /**
   * Generates a concise title for a chat message
   * @param message The first message of a chat session
   * @returns A generated title for the conversation
   */
  async generateTitle(message: string): Promise<string> {
    try {
      this.logger.debug(`Generating title for message: ${message.substring(0, 50)}...`);

      const response = await ollama.chat({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: `Create a concise title for this message, without any formatting or quotes: ${message}. Title:`,
          },
        ],
      });

      const title = response.message.content.trim();
      this.logger.debug(`Generated title: ${title}`);

      return title;
    } catch (error) {
      this.logger.error('Failed to generate title', error);
      // Fallback: return a truncated version of the message
      return message.substring(0, 50) + (message.length > 50 ? '...' : '');
    }
  }
}
