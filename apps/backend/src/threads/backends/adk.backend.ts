import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { BaseTool, Event, LlmAgent, MCPToolset, Runner } from '@google/adk';
import { SqliteSessionService } from '@taico/adk-session-store';
import { getConfig } from 'src/config/env.config';
import { randomUUID } from 'crypto';
import { basename, dirname, extname, join } from 'node:path';
import { ChatBackend, ChatStreamEvent, RunTaskArgs, StreamMessageArgs } from './chat-backend.interface';
import { buildThreadScopedInstructions, formatMessage } from './chat-backend.utils';

@Injectable()
export class AdkBackend implements ChatBackend, OnModuleDestroy {
  private readonly logger = new Logger(AdkBackend.name);
  private readonly sessionService: SqliteSessionService;

  constructor() {
    this.sessionService = new SqliteSessionService({
      filename: this.getChatDatabasePath(getConfig().databasePath),
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.sessionService.close();
    } catch (error) {
      this.logger.warn({
        message: 'Failed to close ADK session store',
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack, name: error.name }
            : String(error),
      });
    }
  }

  async ensureAvailable(): Promise<void> {
    // ADK authenticates via Google AI environment variables (GOOGLE_API_KEY or Vertex AI config).
    // Nothing to check at startup.
  }

  async createConversation(threadId: string): Promise<{ id: string }> {
    const session = await this.sessionService.createSession({
      appName: 'taico-chat',
      sessionId: randomUUID(),
      userId: threadId,
    });
    return { id: session.id };
  }

  async *streamMessage(args: StreamMessageArgs): AsyncGenerator<ChatStreamEvent> {
    try {
      const instructions = buildThreadScopedInstructions(args.systemPrompt, args.threadId, {
        useNamespacedToolNames: true,
      });
      const runner = await this.createRunner(
        args.token,
        args.modelId ?? 'gemini-2.5-flash',
        instructions,
      );
      const stream = runner.runAsync({
        userId: args.threadId,
        sessionId: args.conversationId,
        newMessage: {
          role: 'user',
          parts: [{ text: formatMessage(args.message, args.actor) }],
        },
      });

      const finalChunks: string[] = [];
      let sawPartial = false;

      for await (const event of stream) {
        yield* this.yieldActivityEvents(event);

        const textParts = this.parseTextParts(event);
        if (textParts.length === 0) {
          continue;
        }

        const chunk = textParts.join('');

        if (event.partial) {
          sawPartial = true;
          finalChunks.push(chunk);
          yield { type: 'response_delta', delta: chunk };
          continue;
        }

        if (!sawPartial) {
          finalChunks.push(chunk);
          yield { type: 'response_delta', delta: chunk };
        }
      }

      const finalContent = finalChunks.join('').trim();
      if (finalContent) {
        yield { type: 'final_response', content: finalContent };
      }
    } catch (error) {
      this.logger.error({
        message: 'ADK agent run failed',
        threadId: args.threadId,
        conversationId: args.conversationId,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack, name: error.name }
            : String(error),
      });
      yield { type: 'error', error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async generateText(prompt: string, modelId: string | null): Promise<string | null> {
    try {
      const sessionId = randomUUID();
      const userId = `gen-${randomUUID()}`;

      await this.sessionService.createSession({
        appName: 'taico-chat',
        sessionId,
        userId,
      });

      const agent = new LlmAgent({
        name: 'text_generator',
        model: modelId ?? 'gemini-2.5-flash',
        description: '',
        instruction: '',
        tools: [],
      });

      const runner = new Runner({
        appName: 'taico-chat',
        agent,
        sessionService: this.sessionService,
      });

      const stream = runner.runAsync({
        userId,
        sessionId,
        newMessage: { role: 'user', parts: [{ text: prompt }] },
      });

      const finalChunks: string[] = [];
      let sawPartial = false;

      for await (const event of stream) {
        const textParts = this.parseTextParts(event);
        if (textParts.length === 0) continue;

        const chunk = textParts.join('');
        if (event.partial) {
          sawPartial = true;
          finalChunks.push(chunk);
        } else if (!sawPartial) {
          finalChunks.push(chunk);
        }
      }

      const result = finalChunks.join('').trim();
      return result || null;
    } catch (error) {
      this.logger.warn({
        message: 'ADK text generation failed',
        error: error instanceof Error
          ? { message: error.message, name: error.name }
          : String(error),
      });
      return null;
    }
  }

  async runTask(args: RunTaskArgs): Promise<void> {
    const sessionId = randomUUID();
    const userId = `task-${randomUUID()}`;

    await this.sessionService.createSession({
      appName: 'taico-chat',
      sessionId,
      userId,
    });

    const runner = await this.createRunner(
      args.token,
      args.modelId ?? 'gemini-2.5-flash',
      args.instructions,
    );

    const stream = runner.runAsync({
      userId,
      sessionId,
      newMessage: { role: 'user', parts: [{ text: args.prompt }] },
    });

    // Drain the stream — MCP tool calls happen as side effects during iteration
    for await (const _ of stream) { /* noop */ }
  }

  private async createRunner(token: string, modelId: string, instructions: string): Promise<Runner> {
    const baseUrl = getConfig().issuerUrl;

    const agent = new LlmAgent({
      name: 'taico',
      model: modelId,
      description: '',
      instruction: instructions,
      tools: [
        new NamespacedMCPToolset(
          {
            type: 'StreamableHTTPConnectionParams',
            url: `${baseUrl}/api/v1/tasks/tasks/mcp`,
            header: { Authorization: `Bearer ${token}` },
          },
          'tasks',
        ),
        new NamespacedMCPToolset(
          {
            type: 'StreamableHTTPConnectionParams',
            url: `${baseUrl}/api/v1/context/blocks/mcp`,
            header: { Authorization: `Bearer ${token}` },
          },
          'context',
        ),
      ],
    });

    return new Runner({
      appName: 'taico-chat',
      agent,
      sessionService: this.sessionService,
    });
  }

  private parseTextParts(event: Event): string[] {
    if (!event.content?.parts) {
      return [];
    }

    return event.content.parts
      .filter((part) => !part.thought)
      .map((part) => part.text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0);
  }

  private *yieldActivityEvents(event: Event): Generator<ChatStreamEvent> {
    if (!event.content?.parts) {
      return;
    }

    for (const part of event.content.parts) {
      if (part.thought) {
        yield { type: 'agent_activity', kind: 'thinking' };
      }
      if (part.functionCall || part.functionResponse) {
        yield { type: 'agent_activity', kind: 'tool_calling' };
      }
    }
  }

  private getChatDatabasePath(databasePath: string): string {
    if (databasePath === ':memory:') {
      return databasePath;
    }

    const extension = extname(databasePath);
    if (!extension) {
      return `${databasePath}-chat`;
    }

    const filename = basename(databasePath, extension);
    return join(dirname(databasePath), `${filename}-chat${extension}`);
  }
}

class NamespacedTool extends BaseTool {
  constructor(
    private readonly wrappedTool: BaseTool,
    private readonly namespacedName: string,
  ) {
    super({
      name: namespacedName,
      description: wrappedTool.description,
      isLongRunning: wrappedTool.isLongRunning,
    });
  }

  override _getDeclaration() {
    const declaration = this.wrappedTool._getDeclaration();

    if (!declaration) {
      return declaration;
    }

    return {
      ...declaration,
      name: this.namespacedName,
    };
  }

  override async runAsync(request: Parameters<BaseTool['runAsync']>[0]) {
    return this.wrappedTool.runAsync(request);
  }
}

class NamespacedMCPToolset extends MCPToolset {
  constructor(
    connectionParams: ConstructorParameters<typeof MCPToolset>[0],
    private readonly serverName: string,
  ) {
    super(connectionParams);
  }

  override async getTools(context?: Parameters<MCPToolset['getTools']>[0]) {
    const tools = await super.getTools(context);
    return tools.map(
      (tool) => new NamespacedTool(tool, `mcp__${this.serverName}__${tool.name}`),
    );
  }
}
