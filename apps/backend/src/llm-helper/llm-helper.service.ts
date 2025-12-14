import { Injectable, Logger } from '@nestjs/common';
import { Ollama } from 'ollama';
import { getConfig } from '../config/env.config';

@Injectable()
export class LlmHelperService {
  private readonly logger = new Logger(LlmHelperService.name);
  private readonly host = getConfig().ollamaHost;
  private readonly ollama = new Ollama({ host: this.host });
  private readonly model = 'qwen2.5:0.5b';

  constructor() {
    void this.ensureModelAvailable();
  }

  private async ensureModelAvailable(): Promise<void> {
    try {
      const { models } = await this.ollama.list();
      const modelExists = models.some((model) => model.name === this.model);

      if (!modelExists) {
        this.logger.log(`Model ${this.model} not found. Pulling from Ollama...`);

        try {
          await this.ollama.pull({ model: this.model });
        } catch (error) {
          this.logger.error(`Failed to pull model ${this.model}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to verify Ollama models', error);
    }
  }

  /**
   * Generates a concise title for a chat message
   * @param message The first message of a chat session
   * @returns A generated title for the conversation
   */
  async generateTitle(message: string): Promise<string> {
    try {
      this.logger.debug(`Generating title for message: ${message.substring(0, 50)}...`);

      const response = await this.ollama.chat({
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
      void this.ensureModelAvailable();
      // Fallback: return a truncated version of the message
      return message.substring(0, 50) + (message.length > 50 ? '...' : '');
    }
  }
}
