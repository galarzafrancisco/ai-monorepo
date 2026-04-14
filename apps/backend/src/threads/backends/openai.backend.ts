import { Injectable, Logger } from '@nestjs/common';
import {
  Agent,
  OpenAIProvider,
  Runner,
  run,
  setDefaultOpenAIClient,
  setDefaultOpenAIKey,
} from '@openai/agents';
import { OpenAI } from 'openai';
import { ChatProvidersService } from 'src/chat-providers/chat-providers.service';
import { OpenAiMcpServerFactoryService } from '../openai-mcp-server-factory.service';
import { ChatBackend, ChatStreamEvent, RunTaskArgs, StreamMessageArgs } from './chat-backend.interface';
import { buildThreadScopedInstructions, formatMessage } from './chat-backend.utils';

type RunStreamEvent = Awaited<ReturnType<typeof run>> extends AsyncIterable<infer T> ? T : never;

@Injectable()
export class OpenAiBackend implements ChatBackend {
  private readonly logger = new Logger(OpenAiBackend.name);

  constructor(
    private readonly chatProvidersService: ChatProvidersService,
    private readonly openAiMcpServerFactoryService: OpenAiMcpServerFactoryService,
  ) {}

  async ensureAvailable(): Promise<void> {
    const config = await this.chatProvidersService.getActiveChatProviderConfig();
    if (!config.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
  }

  async createConversation(threadId: string): Promise<{ id: string }> {
    const apiKey = await this.getApiKey();
    const client = new OpenAI({ apiKey });
    const conversation = await client.conversations.create({ metadata: { threadId } });
    return conversation;
  }

  async generateText(prompt: string, modelId: string | null): Promise<string | null> {
    try {
      const apiKey = await this.getApiKey();
      const client = new OpenAI({ apiKey });
      const response = await client.responses.create({
        model: modelId ?? 'gpt-5.2',
        input: prompt,
      });
      return response.output_text?.trim() || null;
    } catch (error) {
      this.logger.warn({
        message: 'OpenAI text generation failed',
        error: error instanceof Error
          ? { message: error.message, name: error.name }
          : String(error),
      });
      return null;
    }
  }

  async runTask(args: RunTaskArgs): Promise<void> {
    const apiKey = await this.getApiKey();
    const modelProvider = this.configureOpenAiSdk(apiKey);
    const mcpServers = await this.openAiMcpServerFactoryService.createServers({ token: args.token });
    const agent = new Agent({
      name: 'taico task runner',
      instructions: args.instructions,
      model: args.modelId ?? 'gpt-5.2-codex',
      mcpServers,
    });
    const runner = new Runner({ modelProvider });
    await runner.run(agent, args.prompt);
  }

  async *streamMessage(args: StreamMessageArgs): AsyncGenerator<ChatStreamEvent> {
    try {
      const apiKey = await this.getApiKey();
      const modelProvider = this.configureOpenAiSdk(apiKey);
      const mcpServers = await this.openAiMcpServerFactoryService.createServers({ token: args.token });
      const agent = new Agent({
        name: args.agentName,
        instructions: buildThreadScopedInstructions(args.systemPrompt, args.threadId),
        model: args.modelId ?? 'gpt-5.2-codex',
        mcpServers,
      });
      const runner = new Runner({ modelProvider });

      this.logger.log(`Sending message to ${args.conversationId}`);

      const result = await runner.run(agent, formatMessage(args.message, args.actor), {
        conversationId: args.conversationId,
        stream: true,
      });

      for await (const event of result) {
        const textDelta = this.parseResponseTextDelta(event);
        if (textDelta) {
          yield { type: 'response_delta', delta: textDelta };
        }

        if (event.type === 'run_item_stream_event') {
          switch (event.item.type) {
            case 'reasoning_item':
              yield { type: 'agent_activity', kind: 'thinking' };
              break;
            case 'tool_call_item':
              yield { type: 'agent_activity', kind: 'tool_calling' };
              break;
            case 'tool_call_output_item':
              break;
            case 'message_output_item':
              if (event.item.content) {
                yield { type: 'final_response', content: event.item.content };
              }
              break;
          }
        }
      }
    } catch (error) {
      this.logger.error({
        message: 'OpenAI agent run failed',
        threadId: args.threadId,
        conversationId: args.conversationId,
        error: error instanceof Error
          ? { message: error.message, stack: error.stack, name: error.name }
          : String(error),
      });
      yield { type: 'error', error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  private async getApiKey(): Promise<string> {
    const config = await this.chatProvidersService.getActiveChatProviderConfig();
    if (!config.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    return config.apiKey;
  }

  private configureOpenAiSdk(apiKey: string): OpenAIProvider {
    const client = new OpenAI({ apiKey });
    setDefaultOpenAIClient(client);
    setDefaultOpenAIKey(apiKey);
    return new OpenAIProvider({ openAIClient: client });
  }

  private parseResponseTextDelta(event: RunStreamEvent): string | null {
    if (event.type !== 'raw_model_stream_event') {
      return null;
    }

    if (event.data.type !== 'output_text_delta') {
      return null;
    }

    return event.data.delta;
  }
}
