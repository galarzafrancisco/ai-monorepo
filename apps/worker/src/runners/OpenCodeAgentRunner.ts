// OpenCodeAgentRunner.ts
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { createOpencodeClient, OpencodeClient, TextPartInput } from "@opencode-ai/sdk";
import { OpencodeAsyncMessageFormatter } from "../formatters/OpencodeMessageFormatter.js";
import { EXECUTION_ID_HEADER } from "../helpers/config.js";
import { AgentModelConfig, AgentRunContext, Model, TokenUsage } from "./AgentRunner.js";
import { InterruptedExecutionError } from "../task-execution-errors.js";

type OpenCodeMcpServerConfig =
  | {
      type: 'remote';
      url: string;
      headers: Record<string, string>;
      enabled: true;
    }
  | {
      type: 'local';
      command: string[];
      enabled: true;
    };

type ManagedOpencodeServer = {
  client: OpencodeClient;
  server: {
    close(): void;
  };
};

function stopProcessTree(proc: ChildProcessWithoutNullStreams): void {
  if (proc.exitCode !== null || proc.signalCode !== null) {
    return;
  }

  if (process.platform === 'win32' && proc.pid) {
    const result = spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
      windowsHide: true,
    });
    if (!result.error && result.status === 0) {
      return;
    }
  }

  if (process.platform !== 'win32' && proc.pid) {
    try {
      process.kill(-proc.pid, 'SIGTERM');
    } catch {
      proc.kill('SIGTERM');
    }

    setTimeout(() => {
      if (proc.exitCode !== null || proc.signalCode !== null || !proc.pid) {
        return;
      }
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch {
        proc.kill('SIGKILL');
      }
    }, 1_000).unref();
    return;
  }

  proc.kill('SIGTERM');
}

export class OpencodeAgentRunner extends BaseAgentRunner {
  readonly kind: string;

  // Mutex for process.chdir: serializes all instances so only one
  // changes the working directory at a time.
  private static chdirLock: Promise<void> = Promise.resolve();

  private client: OpencodeClient | null = null;
  private abortController: AbortController = new AbortController();
  private close: () => void = () => {};
  private model: Model;
  private activeSessionId: string | null = null;
  private activeSessionDirectory: string | null = null;
  private interruptRequested = false;
  private abortConfirmed = false;
  private abortPromise: Promise<boolean> | undefined;

  constructor(modelConfig: AgentModelConfig = {}, kind = 'opencode') {
    super();
    this.kind = kind;
    const hasCustomModel = Boolean(modelConfig.providerId && modelConfig.modelId);
    this.model = {
      providerId: hasCustomModel ? modelConfig.providerId! : 'openai',
      modelId: hasCustomModel ? modelConfig.modelId! : 'gpt-5.4',
    };
  }

  override getModel() {
    return this.model;
  }

  private static readonly CHDIR_TIMEOUT_MS = 60_000; // 1 min — if we wait longer, something is stuck

  async initBullshit({
    executionId,
    cwd,
    baseUrl,
    accessToken,
  }: {
    executionId: string;
    cwd: string;
    baseUrl: string;
    accessToken: string;
  }) {
    // Disgusting hack to start the server in the working directory
    // because Opencode has a bug where running a session in a different
    // folder breaks realtime events (???)
    //
    // We serialize via a promise chain so parallel runners don't stomp
    // on each other's cwd. A timeout prevents waiting forever if a
    // previous init hangs.

    let release!: () => void;
    const acquired = new Promise<void>(resolve => { release = resolve; });

    const prev = OpencodeAgentRunner.chdirLock;
    OpencodeAgentRunner.chdirLock = acquired;

    // Wait for the previous holder, but not forever.
    await Promise.race([
      prev,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
          `initBullshit: timed out after ${OpencodeAgentRunner.CHDIR_TIMEOUT_MS}ms waiting for chdir lock — a previous init is likely stuck`
        )), OpencodeAgentRunner.CHDIR_TIMEOUT_MS),
      ),
    ]);

    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      await this.init({ executionId, baseUrl, accessToken });
    } finally {
      process.chdir(originalCwd);
      release();
    }
  }

  private shutdown() {
    this.abortController.abort();
    this.close();
  }

  private async abortActiveSession(): Promise<boolean> {
    if (!this.client || !this.activeSessionId) {
      return false;
    }

    try {
      const result = await this.client.session.abort({
        path: {
          id: this.activeSessionId,
        },
        query: this.activeSessionDirectory
          ? {
              directory: this.activeSessionDirectory,
            }
          : undefined,
      });

      if (result.error) {
        console.warn('[OpenCodeAgentRunner] Failed to abort session:', result.error);
        return false;
      }

      return result.data === true;
    } catch (error) {
      console.warn('[OpenCodeAgentRunner] Failed to abort session:', error);
      return false;
    }
  }

  cancel(): void {
    this.requestInterrupt();
  }

  private requestInterrupt(): void {
    if (this.interruptRequested) {
      return;
    }

    this.interruptRequested = true;
    console.log('[OpenCodeAgentRunner] Interrupt requested, aborting session');
    this.abortPromise = this.abortActiveSession().then((confirmed) => {
      this.abortConfirmed = confirmed;
      if (confirmed) {
        this.shutdown();
      }
      return confirmed;
    });
  }

  private async wasAbortApplied(): Promise<boolean> {
    return this.abortConfirmed || (this.abortPromise ? await this.abortPromise : false);
  }

  async init({
    executionId,
    baseUrl,
    accessToken,
  }: {
    executionId: string;
    baseUrl: string;
    accessToken: string;
  }) {

    console.log('Starting Opencode client');

    let lastError: unknown;
    const PORT_START = 4000;
    const PORT_END = 4100;

    for (let port = PORT_START; port < PORT_END; port++) {
      try {
        console.log(`Trying port ${port}...`);

        this.abortController = new AbortController();
        const opencode = await this.createManagedOpencode({
          port,
          timeout: 20 * 3600,
          signal: this.abortController.signal,
          config: {
            mcp: this.buildMcpConfig({ executionId, baseUrl, accessToken }),
          }
        });

        this.client = opencode.client;
        this.close = opencode.server.close;
        console.log(`Opencode started on port ${port}`);
        return;
      } catch (err) {
        console.warn(`Port ${port} failed, trying next...`);
        lastError = err;
      }
    }

    throw new Error(`Failed to start Opencode on ports ${PORT_START}–${PORT_END}: ${String(lastError)}`);
  }

  private async createManagedOpencode({
    port,
    timeout,
    signal,
    config,
  }: {
    port: number;
    timeout: number;
    signal: AbortSignal;
    config: {
      mcp: Record<string, OpenCodeMcpServerConfig>;
    };
  }): Promise<ManagedOpencodeServer> {
    const proc = spawn(
      'opencode',
      ['serve', '--hostname=127.0.0.1', `--port=${port}`],
      {
        detached: process.platform !== 'win32',
        env: {
          ...process.env,
          OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
        },
      },
    );
    let closed = false;
    let output = '';

    const close = () => {
      if (closed) {
        return;
      }
      closed = true;
      stopProcessTree(proc);
    };

    const clearAbort = () => signal.removeEventListener('abort', close);
    signal.addEventListener('abort', close, { once: true });
    proc.once('exit', clearAbort);
    proc.once('error', clearAbort);

    try {
      const url = await new Promise<string>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          close();
          reject(new Error(`Timeout waiting for OpenCode server to start after ${timeout}ms`));
        }, timeout);

        const fail = (error: unknown) => {
          clearTimeout(timeoutId);
          close();
          reject(error);
        };

        proc.stdout.on('data', (chunk) => {
          output += chunk.toString();
          for (const line of output.split('\n')) {
            if (!line.startsWith('opencode server listening')) {
              continue;
            }

            const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
            if (!match) {
              fail(new Error(`Failed to parse OpenCode server url from output: ${line}`));
              return;
            }

            clearTimeout(timeoutId);
            resolve(match[1]);
            return;
          }
        });

        proc.stderr.on('data', (chunk) => {
          output += chunk.toString();
        });

        proc.once('exit', (code, signalCode) => {
          fail(
            new Error(
              `OpenCode server exited before startup (code=${code}, signal=${signalCode})${output.trim() ? `\n${output}` : ''}`,
            ),
          );
        });
        proc.once('error', fail);

        if (signal.aborted) {
          fail(signal.reason ?? new Error('OpenCode server startup aborted'));
        }
      });

      return {
        client: createOpencodeClient({
          baseUrl: url,
        }),
        server: {
          close,
        },
      };
    } catch (error) {
      clearAbort();
      throw error;
    }
  }

  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
    onToolCall?: (toolName: string) => void | Promise<void>,
    onTokenUsage?: (usage: TokenUsage) => void | Promise<void>,
  ): Promise<string> {
    const formatter = new OpencodeAsyncMessageFormatter(ctx.agentSlug);
    this.runtimeMcpServers = ctx.mcpServers;

    let removeAbortListener: (() => void) | undefined;
    this.interruptRequested = false;
    this.abortConfirmed = false;
    this.abortPromise = undefined;

    if (ctx.abortSignal) {
      if (ctx.abortSignal.aborted) {
        throw new InterruptedExecutionError('OpenCode agent execution was interrupted before start');
      }

      const onAbort = () => {
        this.requestInterrupt();
      };
      ctx.abortSignal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => ctx.abortSignal?.removeEventListener('abort', onAbort);
    }

    try {
      await this.initBullshit({
        executionId: ctx.executionId,
        cwd: ctx.cwd,
        baseUrl: ctx.baseUrl,
        accessToken: ctx.accessToken,
      });
      // await this.init({ executionId: ctx.executionId });

      if (!this.client) {
        throw new Error("Failed to create Opencode client");
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
        throw new Error("Failed to create Opencode session");
      }
      this.activeSessionId = session.id;
      this.activeSessionDirectory = ctx.cwd;

      if (this.interruptRequested) {
        const confirmed = await this.abortActiveSession();
        this.abortConfirmed = confirmed;
        if (confirmed) {
          this.shutdown();
        }
        throw new InterruptedExecutionError('OpenCode agent execution was interrupted before prompt start');
      }

      await setSession(session.id);
      console.log(`created session ${session.id} in ${session.directory}`);
      // Session is created in the right dir ✅

      const events = await this.client.event.subscribe(); // SSE stream

      const prompt: TextPartInput = {
        type: 'text',
        text: ctx.prompt,
      }
      let finalResult = '';
      await this.client.session.promptAsync({
        path: {
          id: session.id,
        },
        // NOTE: adding a directory breaks realtime events 🤷🏻‍♂️: https://github.com/anomalyco/opencode/issues/11522
        // NOTE: Good news is we don't need it because the session carries the dir.
        // NOTE: Acutally we need to. I've implemented a horrible hack to CD before starting the server.
        // query: {
        //   directory: ctx.cwd,
        // },
        body: {
          model: {
            providerID: this.model.providerId,
            modelID: this.model.modelId,
          },
          parts: [prompt],
        }
      })

      if (this.interruptRequested && await this.wasAbortApplied()) {
        throw new InterruptedExecutionError('OpenCode agent execution was interrupted');
      }

      console.log("--------- STARTING EVENT LOOP ---------");
      for await (const event of events.stream) {
        if (this.interruptRequested && await this.wasAbortApplied()) {
          throw new InterruptedExecutionError('OpenCode agent execution was interrupted');
        }

        // Detect end of session
        if (event.type == 'session.idle') {
          console.log('session.idle');
          if (this.interruptRequested && await this.wasAbortApplied()) {
            throw new InterruptedExecutionError('OpenCode agent execution was interrupted');
          }
          break;
        }

        if (
          event.type === 'message.part.updated' &&
          !event.properties.delta &&
          event.properties.part.type === 'tool'
        ) {
          await onToolCall?.(event.properties.part.tool);
        }

        const usage = extractOpencodeTokenUsage(event);
        if (usage) {
          await onTokenUsage?.(usage);
        }

        const message = formatter.format(event);
        if (message) {
          await emit(message);
        }

        if (this.interruptRequested && await this.wasAbortApplied()) {
          throw new InterruptedExecutionError('OpenCode agent execution was interrupted');
        }
      }
      console.log("--------- ENDING EVENT LOOP ---------");
      console.log('returning final result');
      return finalResult;
    } catch (error) {
      if (this.interruptRequested && await this.wasAbortApplied()) {
        console.log('[OpenCodeAgentRunner] Execution interrupted');
        throw new InterruptedExecutionError('OpenCode agent execution was interrupted');
      }
      console.error(error);
      throw error;
    } finally {
      removeAbortListener?.();
      console.log('shutting down Opencode client');
      this.shutdown();
      this.activeSessionId = null;
      this.activeSessionDirectory = null;
      this.runtimeMcpServers = undefined;
    }
  }

  private buildMcpConfig({
    executionId,
    baseUrl,
    accessToken,
  }: {
    executionId: string;
    baseUrl: string;
    accessToken: string;
  }): Record<string, OpenCodeMcpServerConfig> {
    const runtimeMcpServers =
      this.runtimeMcpServers ?? {
        tasks: {
          type: 'http' as const,
          url: `${baseUrl}/api/v1/tasks/tasks/mcp`,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            [EXECUTION_ID_HEADER]: executionId,
          },
        },
        context: {
          type: 'http' as const,
          url: `${baseUrl}/api/v1/context/blocks/mcp`,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            [EXECUTION_ID_HEADER]: executionId,
          },
        },
      };

    const config: Record<string, OpenCodeMcpServerConfig> = {};
    for (const [providedId, server] of Object.entries(runtimeMcpServers)) {
      if (server.type === 'http') {
        config[providedId] = {
          type: 'remote',
          url: server.url,
          headers: server.headers,
          enabled: true,
        };
        continue;
      }

      config[providedId] = {
        type: 'local',
        command: [server.command, ...server.args],
        enabled: true,
      };
    }

    return config;
  }

  private runtimeMcpServers?: AgentRunContext['mcpServers'];
}

type OpencodeTokenCounts = {
  input?: unknown;
  output?: unknown;
  total?: unknown;
};

function extractOpencodeTokenUsage(event: unknown): TokenUsage | null {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const properties = (event as {
    properties?: {
      info?: { tokens?: OpencodeTokenCounts };
      message?: { info?: { tokens?: OpencodeTokenCounts } };
    };
  }).properties;

  const tokens = properties?.info?.tokens ?? properties?.message?.info?.tokens;
  if (!tokens) {
    return null;
  }

  const inputTokens = toTokenCount(tokens.input);
  const outputTokens = toTokenCount(tokens.output);
  let totalTokens = toTokenCount(tokens.total);

  if (
    totalTokens === null &&
    inputTokens !== null &&
    outputTokens !== null
  ) {
    totalTokens = inputTokens + outputTokens;
  }

  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function toTokenCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}
