import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { Response as OpenAiResponse } from 'openai/resources/responses/responses';
import { ChatProvidersService } from '../chat-providers/chat-providers.service';

export type GenerateTextInput = {
  prompt: string;
  model?: string;
};

@Injectable()
export class OpenAiResponsesService {
  private readonly logger = new Logger(OpenAiResponsesService.name);

  constructor(private readonly chatProvidersService: ChatProvidersService) {}

  private extractResponseText(response: OpenAiResponse): string {
    return response.output_text.trim();
  }

  async generateText(input: GenerateTextInput): Promise<string | null> {
    let apiKey: string;
    try {
      const config = await this.chatProvidersService.getActiveChatProviderConfig();
      if (!config.apiKey) {
        return null;
      }
      apiKey = config.apiKey;
    } catch (error) {
      this.logger.warn({
        message: 'Skipping OpenAI response generation because no active chat provider is configured',
        error:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : String(error),
      });
      return null;
    }

    try {
      const client = new OpenAI({ apiKey });
      const response = await client.responses.create({
        model: input.model || 'gpt-5.2',
        input: input.prompt,
      });

      const text = this.extractResponseText(response);
      return text || null;
    } catch (error) {
      this.logger.warn({
        message: 'OpenAI response generation failed',
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      });
      return null;
    }
  }
}
