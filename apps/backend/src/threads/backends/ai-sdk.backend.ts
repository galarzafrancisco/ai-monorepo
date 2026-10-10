import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { generateText, ToolLoopAgent, type LanguageModel, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { ChatProvidersService } from 'src/chat-providers/chat-providers.service';
import { ChatProviderType } from 'src/chat-providers/enums';
import { AiSdkMcpToolsService } from '../ai-sdk-mcp-tools.service';
import { ThreadChatHistoryEntity } from '../thread-chat-history.entity';
import { ThreadMessageEntity } from '../thread-message.entity';
import { ChatBackend, ChatStreamEvent, RunTaskArgs, StreamMessageArgs } from './chat-backend.interface';
import { buildThreadScopedInstructions, formatMessage } from './chat-backend.utils';

@Injectable()
export class AiSdkBackend implements ChatBackend {
  private readonly logger = new Logger(AiSdkBackend.name);
  private readonly pendingRuns = new Map<string, Promise<void>>();

  constructor(
    private readonly chatProvidersService: ChatProvidersService,
    private readonly mcpToolsService: AiSdkMcpToolsService,
    @InjectRepository(ThreadChatHistoryEntity)
    private readonly historyRepository: Repository<ThreadChatHistoryEntity>,
    @InjectRepository(ThreadMessageEntity)
    private readonly messageRepository: Repository<ThreadMessageEntity>,
  ) {}

  async ensureAvailable(): Promise<void> {
    await this.getModel(null);
  }

  async createConversation(_threadId: string): Promise<{ id: string }> {
    await this.ensureAvailable();
    return { id: randomUUID() };
  }

  private async getModel(modelId: string | null): Promise<LanguageModel> {
    const config = await this.chatProvidersService.getActiveChatProviderConfig();
    if (config.type === ChatProviderType.OPENAI) {
      if (!config.apiKey) throw new Error('OpenAI API key is not configured');
      return createOpenAI({ apiKey: config.apiKey })(modelId ?? 'gpt-5.4');
    }

    // The persisted `adk` provider now selects Google's AI SDK adapter.
    // Keep the environment variables supported by the previous ADK runtime.
    if (process.env.GOOGLE_GENAI_USE_VERTEXAI?.toLowerCase() === 'true') {
      return createVertex({
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION,
      })(modelId ?? 'gemini-3.6-flash');
    }
    return createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    })(modelId ?? 'gemini-3.6-flash');
  }

  async generateText(prompt: string, modelId: string | null): Promise<string | null> {
    try {
      const result = await generateText({ model: await this.getModel(modelId), prompt });
      return result.text.trim() || null;
    } catch (error) {
      this.logger.warn({ message: 'AI SDK text generation failed', error: String(error) });
      return null;
    }
  }

  async runTask(args: RunTaskArgs): Promise<void> {
    const model = await this.getModel(args.modelId);
    const { tools, close } = await this.mcpToolsService.createTools(args.token);
    try {
      const agent = new ToolLoopAgent({ model, instructions: args.instructions, tools });
      await agent.generate({ prompt: args.prompt });
    } finally {
      await close();
    }
  }

  private async loadHistory(args: StreamMessageArgs): Promise<ModelMessage[]> {
    const history = await this.historyRepository.findOneBy({ threadId: args.threadId });
    if (history) return history.messages;

    // Existing OpenAI/ADK threads start with their visible transcript. The current
    // message is already persisted by ThreadsService and is appended below once.
    const transcript = await this.messageRepository.find({
      where: { threadId: args.threadId },
      relations: ['createdByActor'],
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const currentIndex = transcript.findIndex((message) => message.id === args.messageId);
    return transcript.slice(0, currentIndex < 0 ? 0 : currentIndex).map((message) => {
      const actor = message.createdByActor;
      return actor?.slug === 'taico'
        ? { role: 'assistant' as const, content: message.content }
        : { role: 'user' as const, content: actor ? formatMessage(message.content, actor) : message.content };
    });
  }

  async *streamMessage(args: StreamMessageArgs): AsyncGenerator<ChatStreamEvent> {
    // Serialize turns per thread so overlapping sends cannot overwrite history.
    const previous = this.pendingRuns.get(args.threadId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.pendingRuns.set(args.threadId, current);
    await previous;
    const abortController = new AbortController();
    let close: (() => Promise<void>) | undefined;
    try {
      const model = await this.getModel(args.modelId);
      const mcp = await this.mcpToolsService.createTools(args.token);
      close = mcp.close;
      const messages: ModelMessage[] = [
        ...await this.loadHistory(args),
        { role: 'user', content: formatMessage(args.message, args.actor) },
      ];
      // Retain the user turn even if generation fails, so the next turn still
      // has the request that caused the failure.
      await this.historyRepository.save({ threadId: args.threadId, messages });
      const agent = new ToolLoopAgent({
        model,
        instructions: buildThreadScopedInstructions(args.systemPrompt, args.threadId),
        tools: mcp.tools,
      });
      const result = await agent.stream({ messages, abortSignal: abortController.signal });
      let content = '';
      for await (const event of result.fullStream) {
        switch (event.type) {
          case 'text-delta':
            content += event.text;
            yield { type: 'response_delta', delta: event.text };
            break;
          case 'reasoning-start':
            yield { type: 'agent_activity', kind: 'thinking' };
            break;
          case 'tool-call':
            yield { type: 'agent_activity', kind: 'tool_calling' };
            break;
          case 'error':
            throw event.error;
        }
      }
      const responseMessages = await result.responseMessages;
      await this.historyRepository.save({
        threadId: args.threadId,
        messages: [...messages, ...responseMessages],
      });
      if (content.trim()) yield { type: 'final_response', content: content.trim() };
    } catch (error) {
      this.logger.error({ message: 'AI SDK agent run failed', threadId: args.threadId, error: String(error) });
      yield { type: 'error', error: error instanceof Error ? error : new Error(String(error)) };
    } finally {
      abortController.abort();
      try {
        await close?.();
      } finally {
        release();
        if (this.pendingRuns.get(args.threadId) === current) this.pendingRuns.delete(args.threadId);
      }
    }
  }
}
