import type { Config, Event, OpencodeClient, PermissionRequest } from '@opencode-ai/sdk/v2';
import { BaseAgentRunner } from '../BaseAgentRunner.js';
import type { AgentModelConfig, AgentRunContext, Model, RuntimeMcpServerConfig, TokenUsage } from '../AgentRunner.js';
import { EXECUTION_ID_HEADER } from '../../helpers/config.js';
import { InterruptedExecutionError } from '../../task-execution-errors.js';
import {
  buildOpencodeConfig,
  DEFAULT_TAICO_OPENCODE_POLICY,
  rejectAllApprover,
  resolveExecutionBoundary,
  type PermissionApprover,
  type TaicoOpencodePolicy,
} from './policy.js';
import { OpencodeStartupAbortedError, startOpencodeV2Server, type OpencodeV2Server } from './server.js';
import {
  describeOpencodeError,
  finalAssistantText,
  isAbortError,
  isRunComplete,
  lastAssistantError,
  OpencodeV2EventFormatter,
  OwnedSessions,
  reconcileUsage,
  type OpencodeErrorShape,
  type ReconciledUsage,
  type SessionMessage,
} from './session-events.js';

export type OpenCodeV2RunnerOptions = {
  /** Explicit tool policy. Defaults to DEFAULT_TAICO_OPENCODE_POLICY. */
  policy?: TaicoOpencodePolicy;
  /** Answers `ask` permissions. Defaults to rejecting (headless). */
  approver?: PermissionApprover;
  /** Max time an `ask` may stay pending before it is rejected. */
  permissionTimeoutMs?: number;
  /** If set, ctx.cwd must resolve inside this directory. */
  workspaceRoot?: string;
  /** Bound for spawn → healthy. */
  startupTimeoutMs?: number;
  /** SSE reconnect attempts before the run fails (counter resets on real traffic). */
  maxReconnects?: number;
  reconnectDelayMs?: number;
  /** Remote MCP servers that must be connected before prompting (default: all remote servers). */
  requiredMcp?: string[];
  /** Max wait for required MCP servers to report a settled status. */
  mcpReadyTimeoutMs?: number;
  /** Overrides/extends OpenCode config (providers etc). `mcp` and `permission` are always Taico's. */
  extraConfig?: Config;
  /** Extra env for the server process. */
  env?: NodeJS.ProcessEnv;
  bin?: string;
  port?: number;
  fetch?: typeof fetch;
  /** Observability hook for tests/diagnostics: raw owned events. */
  onRawEvent?: (event: Event) => void;
  /** Test hook: called once the server is up (pid, url) and once the session exists. */
  onLifecycle?: (stage: 'server-started' | 'session-created' | 'prompted', info: { server: OpencodeV2Server; sessionId?: string }) => void;
};

export type OpenCodeV2RunReport = {
  sessionId: string | null;
  serverVersion: string | null;
  usage: ReconciledUsage | null;
  outcome: 'completed' | 'failed' | 'interrupted';
  reconnects: number;
  permissions: Array<{ permission: string; patterns: string[]; reply: 'once' | 'reject' }>;
};

export class OpencodeSessionFailedError extends Error {
  constructor(readonly opencodeError: OpencodeErrorShape) {
    super(`OpenCode session failed: ${describeOpencodeError(opencodeError)}`);
    this.name = 'OpencodeSessionFailedError';
  }
}

export class OpencodeEventStreamLostError extends Error {
  constructor(attempts: number, cause?: unknown) {
    super(`OpenCode event stream lost and not recovered after ${attempts} reconnect attempt(s)`);
    this.name = 'OpencodeEventStreamLostError';
    this.cause = cause;
  }
}

export class OpencodeMcpUnavailableError extends Error {
  constructor(readonly server: string, readonly status: string) {
    // Deliberately no URL/headers/error body: those can carry credentials.
    super(`Required MCP server '${server}' is not available (status: ${status})`);
    this.name = 'OpencodeMcpUnavailableError';
  }
}

type Terminal = { kind: 'idle' } | { kind: 'error'; error: OpencodeErrorShape } | { kind: 'aborted' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Proof-of-concept OpenCode runner on the SDK v2 server/client API.
 *
 * One dedicated server per execution (no pooling). Not wired into task-runner
 * yet; see docs/how-to-guides/opencode-v2-runner.md for the rollout gate.
 */
export class OpenCodeV2AgentRunner extends BaseAgentRunner {
  readonly kind = 'opencode-v2';
  protected override readonly usePeriodicHeartbeat = false;

  private readonly model: Model;
  private readonly cancelController = new AbortController();
  lastReport: OpenCodeV2RunReport | null = null;

  constructor(
    modelConfig: AgentModelConfig = {},
    private readonly options: OpenCodeV2RunnerOptions = {},
  ) {
    super();
    const custom = Boolean(modelConfig.providerId && modelConfig.modelId);
    this.model = {
      providerId: custom ? modelConfig.providerId! : 'openai',
      modelId: custom ? modelConfig.modelId! : 'gpt-5.4',
    };
  }

  override getModel() {
    return this.model;
  }

  override cancel(): void {
    this.cancelController.abort();
  }

  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
    onToolCall?: (toolName: string) => void | Promise<void>,
    onTokenUsage?: (usage: TokenUsage) => void | Promise<void>,
    onHeartbeat?: () => void | Promise<void>,
  ): Promise<string> {
    const opts = this.options;
    const signal = ctx.abortSignal ? AbortSignal.any([ctx.abortSignal, this.cancelController.signal]) : this.cancelController.signal;
    const report: OpenCodeV2RunReport = {
      sessionId: null,
      serverVersion: null,
      usage: null,
      outcome: 'failed',
      reconnects: 0,
      permissions: [],
    };
    this.lastReport = report;

    // 1. Cancel before spawn: nothing has started, nothing to clean up.
    if (signal.aborted) {
      report.outcome = 'interrupted';
      throw new InterruptedExecutionError('OpenCode execution was interrupted before start');
    }

    const cwd = resolveExecutionBoundary(ctx.cwd, opts.workspaceRoot);
    const mcp = ctx.mcpServers ?? defaultTaicoMcp(ctx);
    const config = buildOpencodeConfig({
      mcp,
      policy: opts.policy ?? DEFAULT_TAICO_OPENCODE_POLICY,
      extra: opts.extraConfig,
    });

    let server: OpencodeV2Server | undefined;
    const streamController = new AbortController();
    let heartbeatInFlight = false;
    const heartbeat = () => {
      if (!onHeartbeat || heartbeatInFlight) return;
      heartbeatInFlight = true;
      void Promise.resolve(onHeartbeat()).finally(() => (heartbeatInFlight = false));
    };

    try {
      // 2. Startup is abortable and bounded.
      try {
        server = await startOpencodeV2Server({
          cwd,
          config,
          bin: opts.bin,
          port: opts.port,
          env: opts.env,
          fetch: opts.fetch,
          startupTimeoutMs: opts.startupTimeoutMs,
          signal,
        });
      } catch (error) {
        if (error instanceof OpencodeStartupAbortedError || signal.aborted) {
          throw new InterruptedExecutionError('OpenCode execution was interrupted during startup');
        }
        throw error;
      }
      report.serverVersion = server.version;
      opts.onLifecycle?.('server-started', { server });
      const client = server.client;

      await this.assertMcpReady(client, mcp, opts.requiredMcp);

      const created = await client.session.create({ title: `Taico execution ${ctx.executionId}` });
      if (!created.data) {
        throw new Error(`Failed to create OpenCode session: ${describeOpencodeError(created.error as OpencodeErrorShape)}`);
      }
      const sessionId = created.data.id;
      report.sessionId = sessionId;
      opts.onLifecycle?.('session-created', { server, sessionId });
      await setSession(sessionId);

      // 3. Cancel after session creation but before prompting.
      if (signal.aborted) {
        throw new InterruptedExecutionError('OpenCode execution was interrupted before prompt');
      }

      const owned = new OwnedSessions(sessionId);
      const formatter = new OpencodeV2EventFormatter(ctx.agentSlug);
      const usageByMessage = new Map<string, { input: number; output: number }>();
      const approver = opts.approver ?? rejectAllApprover;
      const permissionTimeoutMs = opts.permissionTimeoutMs ?? 30_000;
      const maxReconnects = opts.maxReconnects ?? 5;
      const reconnectDelayMs = opts.reconnectDelayMs ?? 500;

      const answerPermission = async (request: PermissionRequest) => {
        let reply: 'once' | 'reject' = 'reject';
        try {
          reply = await Promise.race([
            Promise.resolve(approver(request)),
            sleep(permissionTimeoutMs).then(() => 'reject' as const),
          ]);
        } catch {
          reply = 'reject';
        }
        report.permissions.push({ permission: request.permission, patterns: request.patterns, reply });
        await client.permission.reply({ requestID: request.id, reply });
      };

      const handleEvent = async (event: Event): Promise<Terminal | null> => {
        heartbeat();
        if (!owned.accept(event)) return null;
        opts.onRawEvent?.(event);

        if (event.type === 'permission.asked') {
          void answerPermission(event.properties).catch((e) => console.warn('[opencode-v2] permission reply failed', e));
        }
        const tool = formatter.toolStarted(event);
        if (tool) await onToolCall?.(tool);

        if (event.type === 'message.updated' && event.properties.info.role === 'assistant') {
          const t = event.properties.info.tokens;
          usageByMessage.set(event.properties.info.id, { input: t.input, output: t.output });
          let input = 0;
          let output = 0;
          for (const u of usageByMessage.values()) {
            input += u.input;
            output += u.output;
          }
          await onTokenUsage?.({ inputTokens: input, outputTokens: output, totalTokens: input + output });
        }

        const line = formatter.format(event);
        if (line) await emit(line);

        if (event.type === 'session.error' && event.properties.sessionID === sessionId) {
          return isAbortError(event.properties.error) ? { kind: 'aborted' } : { kind: 'error', error: event.properties.error };
        }
        if (event.type === 'session.idle' && event.properties.sessionID === sessionId) {
          return { kind: 'idle' };
        }
        return null;
      };

      // Subscribe BEFORE prompting and wait for the server handshake so no early events are lost.
      let resolveConnected!: () => void;
      const connected = new Promise<void>((r) => (resolveConnected = r));
      let prompted = false;

      const pump = async (): Promise<Terminal> => {
        let attempts = 0;
        let lastError: unknown;
        while (true) {
          const sub = await client.event.subscribe(
            {},
            {
              signal: streamController.signal,
              sseMaxRetryAttempts: 1,
              onSseError: (e) => (lastError = e),
            },
          );
          let sawTraffic = false;
          for await (const event of sub.stream as AsyncIterable<Event>) {
            if (event.type === 'server.connected') {
              resolveConnected();
              // After a reconnect, the run may have finished while no stream was attached:
              // the terminal events are gone for good, so check persisted state once more.
              if (prompted && report.reconnects > 0) {
                const recovered = await this.reconcileAfterDisconnect(client, sessionId);
                if (recovered) return recovered;
              }
              continue;
            }
            if (!sawTraffic && owned.has(eventSessionIdSafe(event))) {
              sawTraffic = true;
              attempts = 0;
            }
            const terminal = await handleEvent(event);
            if (terminal) return terminal;
          }
          if (streamController.signal.aborted) return { kind: 'aborted' };

          // Stream dropped. Reconcile from persisted state: terminal events may have been missed.
          attempts += 1;
          report.reconnects += 1;
          if (prompted) {
            const recovered = await this.reconcileAfterDisconnect(client, sessionId);
            if (recovered) return recovered;
          }
          if (attempts > maxReconnects) {
            throw new OpencodeEventStreamLostError(maxReconnects, lastError);
          }
          await emit(`⚠️ OpenCode event stream disconnected, reconnecting (${attempts}/${maxReconnects})`);
          await sleep(reconnectDelayMs * attempts);
        }
      };

      const onAbort = () => {
        // Ask OpenCode to stop; the pump returns once the abort is reflected (or we stop the server).
        void client.session.abort({ sessionID: sessionId }).catch(() => undefined);
        setTimeout(() => streamController.abort(), 5_000).unref();
      };
      signal.addEventListener('abort', onAbort, { once: true });

      try {
        const pumping = pump();
        pumping.catch(() => undefined);
        await Promise.race([
          connected,
          pumping.then(() => undefined),
          sleep(opts.startupTimeoutMs ?? 30_000).then(() => {
            throw new Error('Timed out waiting for OpenCode event stream');
          }),
        ]);
        if (signal.aborted) {
          throw new InterruptedExecutionError('OpenCode execution was interrupted before prompt');
        }

        const promptResult = await client.session.promptAsync({
          sessionID: sessionId,
          model: { providerID: this.model.providerId, modelID: this.model.modelId },
          parts: [{ type: 'text', text: ctx.prompt }],
        });
        if (promptResult.error) {
          throw new Error(`OpenCode rejected prompt: ${describeOpencodeError(promptResult.error as OpencodeErrorShape)}`);
        }
        prompted = true;
        opts.onLifecycle?.('prompted', { server, sessionId });

        const terminal = await pumping;

        // 4. Usage & result always come from persisted messages, not the stream.
        const messages = await collectMessages(client, owned.all());
        const rootMessages = messages.get(sessionId) ?? [];
        const usage = reconcileUsage([...messages.values()].flat());
        report.usage = usage;
        await onTokenUsage?.({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.inputTokens + usage.outputTokens,
        });

        if (signal.aborted || terminal.kind === 'aborted') {
          throw new InterruptedExecutionError('OpenCode execution was interrupted');
        }
        if (terminal.kind === 'error') {
          await onError?.({ message: describeOpencodeError(terminal.error), rawMessage: terminal.error });
          throw new OpencodeSessionFailedError(terminal.error);
        }
        const messageError = lastAssistantError(rootMessages);
        if (messageError && !isAbortError(messageError)) {
          await onError?.({ message: describeOpencodeError(messageError), rawMessage: messageError });
          throw new OpencodeSessionFailedError(messageError);
        }

        report.outcome = 'completed';
        return finalAssistantText(rootMessages);
      } finally {
        signal.removeEventListener('abort', onAbort);
      }
    } catch (error) {
      if (signal.aborted || error instanceof InterruptedExecutionError) {
        report.outcome = 'interrupted';
        throw error instanceof InterruptedExecutionError
          ? error
          : new InterruptedExecutionError('OpenCode execution was interrupted');
      }
      report.outcome = 'failed';
      throw error;
    } finally {
      streamController.abort();
      // 5. An execution only finishes after the server and all its children are gone.
      await server?.stop();
    }
  }

  private async reconcileAfterDisconnect(client: OpencodeClient, sessionId: string): Promise<Terminal | null> {
    try {
      const [status, messages] = await Promise.all([
        client.session.status(),
        client.session.messages({ sessionID: sessionId }),
      ]);
      const list = (messages.data ?? []) as SessionMessage[];
      if (!isRunComplete(sessionId, status.data, list)) return null;
      const error = lastAssistantError(list);
      if (error) return isAbortError(error) ? { kind: 'aborted' } : { kind: 'error', error };
      return { kind: 'idle' };
    } catch {
      return null;
    }
  }

  private async assertMcpReady(
    client: OpencodeClient,
    mcp: Record<string, RuntimeMcpServerConfig>,
    required?: string[],
  ) {
    const names = required ?? Object.entries(mcp).filter(([, s]) => s.type === 'http').map(([n]) => n);
    if (names.length === 0) return;
    // MCP clients connect asynchronously after boot: wait (boundedly) until every
    // required server has a settled status, then require `connected`.
    const deadline = Date.now() + (this.options.mcpReadyTimeoutMs ?? 20_000);
    let statuses: Record<string, { status: string }> = {};
    while (true) {
      const { data } = await client.mcp.status();
      statuses = (data as Record<string, { status: string }> | undefined) ?? {};
      if (names.every((n) => statuses[n]?.status === 'connected')) return;
      const settledBad = names.find((n) => statuses[n] && statuses[n].status !== 'connected');
      if (settledBad || Date.now() > deadline) break;
      await sleep(100);
    }
    for (const name of names) {
      const status = statuses[name]?.status ?? 'missing';
      if (status !== 'connected') {
        throw new OpencodeMcpUnavailableError(name, status);
      }
    }
  }
}

function eventSessionIdSafe(event: Event): string {
  const props = event.properties as { sessionID?: unknown };
  return typeof props?.sessionID === 'string' ? props.sessionID : '';
}

async function collectMessages(client: OpencodeClient, sessionIds: string[]): Promise<Map<string, SessionMessage[]>> {
  const out = new Map<string, SessionMessage[]>();
  for (const id of sessionIds) {
    const { data } = await client.session.messages({ sessionID: id });
    out.set(id, (data ?? []) as SessionMessage[]);
  }
  return out;
}

function defaultTaicoMcp(ctx: AgentRunContext): Record<string, RuntimeMcpServerConfig> {
  const headers = { Authorization: `Bearer ${ctx.accessToken}`, [EXECUTION_ID_HEADER]: ctx.executionId };
  return {
    tasks: { type: 'http', url: `${ctx.baseUrl}/api/v1/tasks/tasks/mcp`, headers },
    context: { type: 'http', url: `${ctx.baseUrl}/api/v1/context/blocks/mcp`, headers },
  };
}
