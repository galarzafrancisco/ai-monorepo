import type { OpencodeClient, TextPartInput } from '@opencode-ai/sdk';
import { EXECUTION_ID_HEADER } from '../../auth/guards/constants/headers.constants';
import { OpencodeAsyncMessageFormatter } from '../formatters/opencode-message-formatter';
import { BaseAgentRunner } from './base-agent-runner';
import { AgentRunContext } from './agent-runner.types';

type OpencodeModel = {
  providerID: string;
  modelID: string;
};

export class OpencodeAgentRunner extends BaseAgentRunner {
  readonly kind = 'opencode';

  private static chdirLock: Promise<void> = Promise.resolve();
  private static readonly CHDIR_TIMEOUT_MS = 60_000;

  private client: OpencodeClient | null = null;
  private abortController = new AbortController();
  private closeServer: () => void = () => {};

  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: {
      message: string;
      rawMessage?: unknown;
    }) => void | Promise<void>,
  ): Promise<string> {
    const formatter = new OpencodeAsyncMessageFormatter(ctx.agentSlug);
    await this.initInWorkingDirectory(ctx);

    if (!this.client) {
      throw new Error('Failed to create Opencode client');
    }

    const { data: session } = await this.client.session.create({
      body: {
        title: `Session ${new Date().toLocaleString()}`,
      },
      query: {
        directory: ctx.cwd,
      },
    });

    if (!session) {
      this.shutdown();
      throw new Error('Failed to create Opencode session');
    }

    await setSession(session.id);

    const events = await this.client.event.subscribe();
    const prompt: TextPartInput = {
      type: 'text',
      text: ctx.prompt,
    };
    const model = this.resolveModel(ctx);

    void this.client.session.promptAsync({
      path: {
        id: session.id,
      },
      body: {
        model,
        parts: [prompt],
      },
    });

    let finalResult = '';
    try {
      for await (const event of events.stream) {
        if (event.type === 'session.idle') {
          break;
        }

        const message = formatter.format(event);
        if (message) {
          await emit(message);
        }
      }
    } catch (error: unknown) {
      await onError?.({
        message: this.errorToMessage(error),
        rawMessage: error,
      });
      throw error;
    } finally {
      this.shutdown();
    }

    return finalResult;
  }

  private async initInWorkingDirectory(ctx: AgentRunContext): Promise<void> {
    let releaseLock: (() => void) | undefined;
    const acquired = new Promise<void>((resolve) => {
      releaseLock = () => resolve();
    });

    const previous = OpencodeAgentRunner.chdirLock;
    OpencodeAgentRunner.chdirLock = acquired;

    await Promise.race([
      previous,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Timed out after ${OpencodeAgentRunner.CHDIR_TIMEOUT_MS}ms waiting for opencode chdir lock`,
            ),
          );
        }, OpencodeAgentRunner.CHDIR_TIMEOUT_MS);
      }),
    ]);

    const originalCwd = process.cwd();
    process.chdir(ctx.cwd);
    try {
      await this.init(ctx);
    } finally {
      process.chdir(originalCwd);
      releaseLock?.();
    }
  }

  private async init(ctx: AgentRunContext): Promise<void> {
    let lastError: unknown;
    const portStart = 4000;
    const portEnd = 4100;

    for (let port = portStart; port < portEnd; port++) {
      try {
        this.abortController = new AbortController();
        const { createOpencode } = await import('@opencode-ai/sdk');
        const opencode = await createOpencode({
          port,
          timeout: 20 * 3600,
          signal: this.abortController.signal,
          config: {
            mcp: this.buildMcpConfig(ctx),
          },
        });

        this.client = opencode.client;
        this.closeServer = opencode.server.close;
        return;
      } catch (error: unknown) {
        lastError = error;
      }
    }

    throw new Error(
      `Failed to start Opencode on ports ${portStart}-${portEnd}: ${this.errorToMessage(lastError)}`,
    );
  }

  private shutdown(): void {
    this.abortController.abort();
    this.closeServer();
    this.client = null;
  }

  private resolveModel(ctx: AgentRunContext): OpencodeModel {
    const configured =
      typeof ctx.options?.model === 'string' ? ctx.options.model : null;

    if (!configured) {
      return {
        providerID: 'openai',
        modelID: 'gpt-5.2-codex',
      };
    }

    const [providerID, ...modelParts] = configured.split('/');
    const modelID = modelParts.join('/');
    if (!providerID || !modelID) {
      return {
        providerID: 'openai',
        modelID: configured,
      };
    }

    return {
      providerID,
      modelID,
    };
  }

  private buildMcpConfig(ctx: AgentRunContext): Record<
    string,
    {
      type: 'remote';
      url: string;
      headers: Record<string, string>;
      enabled: true;
    }
  > {
    const runtimeMcpServers =
      ctx.mcpServers ?? {
        tasks: {
          type: 'http' as const,
          url: `${ctx.baseUrl}/api/v1/tasks/tasks/mcp`,
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            [EXECUTION_ID_HEADER]: ctx.executionId,
          },
        },
        context: {
          type: 'http' as const,
          url: `${ctx.baseUrl}/api/v1/context/blocks/mcp`,
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            [EXECUTION_ID_HEADER]: ctx.executionId,
          },
        },
      };

    const config: Record<
      string,
      {
        type: 'remote';
        url: string;
        headers: Record<string, string>;
        enabled: true;
      }
    > = {};
    for (const [providedId, server] of Object.entries(runtimeMcpServers)) {
      if (server.type !== 'http') {
        continue;
      }

      config[providedId] = {
        type: 'remote',
        url: server.url,
        headers: server.headers,
        enabled: true,
      };
    }

    return config;
  }
}
