import { io, Socket } from 'socket.io-client';
import {
  ExecutionWireEvents,
  type PostExecutionActivityPayload,
  type PostExecutionTracePayload,
  type ExecutionTraceAck,
  type PostExecutionHeartbeatPayload,
  type PostWorkerHeartbeatPayload,
  type TaskExecutionQueuedWireEvent,
  type ExecutionInterruptRequestWireEvent,
} from '@taico/events';
import { ExecutionTraceSpool } from './execution-trace-spool.js';
import { WorkerAuth } from './auth/worker-auth.js';
import { WORKER_VERSION } from './version.js';

const DEFAULT_TOKEN_REFRESH_SKEW_MS = 60_000;
const ACK_TIMEOUT_MS = 5_000;
const WORKER_HEARTBEAT_INTERVAL_MS = 30_000;
const RECONNECT_RETRY_DELAY_MS = 5_000;

type ActivityAck = ExecutionTraceAck;

export type ExecutionActivityGatewayClientOptions = {
  baseUrl: string;
  traceDirectory: string;
  auth: WorkerAuth;
  debug?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  randomizationFactor?: number;
  tokenRefreshSkewMs?: number;
  onTaskQueued?: (event: TaskExecutionQueuedWireEvent) => void;
  onExecutionInterruptRequest?: (
    event: ExecutionInterruptRequestWireEvent,
  ) => void;
};

export class ExecutionActivityGatewayClient {
  private socket?: Socket;
  private readonly traceSpool: ExecutionTraceSpool;
  private started = false;
  private traceSpoolStarted = false;
  private reconnectAttempts = 0;
  private tokenRefreshTimer?: ReturnType<typeof setTimeout>;
  private reconnectRetryTimer?: ReturnType<typeof setTimeout>;
  private reconnectRetryForceRefresh = false;
  private workerHeartbeatTimer?: ReturnType<typeof setInterval>;
  private reconnectPromise: Promise<void> | null = null;
  private resolveInitialConnect?: () => void;

  constructor(private readonly options: ExecutionActivityGatewayClientOptions) {
    this.traceSpool = new ExecutionTraceSpool(options.traceDirectory, (batch) =>
      this.emitAcknowledgement(ExecutionWireEvents.EXECUTION_TRACE_POST, batch),
    );
  }

  async queueTrace(batch: PostExecutionTracePayload): Promise<void> {
    await this.traceSpool.enqueue(batch);
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    const initialConnectPromise = new Promise<void>((resolve) => {
      this.resolveInitialConnect = resolve;
    });

    await this.connectWithFreshToken();
    await initialConnectPromise;
    await this.traceSpool.start();
    this.traceSpoolStarted = true;
  }

  async stop(): Promise<void> {
    this.started = false;
    this.traceSpoolStarted = false;
    this.clearTokenRefreshTimer();
    this.clearReconnectRetryTimer();
    this.clearWorkerHeartbeatTimer();
    this.clearInitialConnectHandlers();

    const socket = this.socket;
    this.socket = undefined;
    // Resolve outstanding ACK waits before removing their disconnect listeners.
    socket?.disconnect();
    socket?.removeAllListeners();
    await this.traceSpool.stop();
  }

  async publishActivity(
    payload: PostExecutionActivityPayload,
  ): Promise<boolean> {
    return this.emitWithAck(
      ExecutionWireEvents.EXECUTION_ACTIVITY_POST,
      payload,
    );
  }

  async publishHeartbeat(
    payload: PostExecutionHeartbeatPayload,
  ): Promise<boolean> {
    return this.emitWithAck(
      ExecutionWireEvents.EXECUTION_HEARTBEAT_POST,
      payload,
    );
  }

  async publishWorkerHeartbeat(): Promise<boolean> {
    return this.emitWithAck(ExecutionWireEvents.WORKER_HEARTBEAT_POST, {
      workerVersion: WORKER_VERSION,
    });
  }

  private async emitWithAck(
    eventName: string,
    payload?:
      | PostExecutionActivityPayload
      | PostExecutionHeartbeatPayload
      | PostWorkerHeartbeatPayload,
  ): Promise<boolean> {
    return (await this.emitAcknowledgement(eventName, payload)).ok;
  }

  private async emitAcknowledgement(
    eventName: string,
    payload?:
      | PostExecutionTracePayload
      | PostExecutionActivityPayload
      | PostExecutionHeartbeatPayload
      | PostWorkerHeartbeatPayload,
  ): Promise<ActivityAck> {
    if (!this.socket || !this.socket.connected) {
      if (this.options.debug) {
        console.warn(
          `[execution-activity] ${eventName} called while disconnected`,
          eventName === ExecutionWireEvents.EXECUTION_TRACE_POST
            ? {
                executionId:
                  payload && 'executionId' in payload
                    ? payload.executionId
                    : undefined,
              }
            : payload,
        );
      }
      return { ok: false, retryable: 'disconnected' };
    }

    const socket = this.socket;
    // Allow transfer at 64 KiB/s plus server processing time for raw traces.
    // Other activity and heartbeat acknowledgements retain their short timeout.
    const timeoutMs =
      eventName === ExecutionWireEvents.EXECUTION_TRACE_POST
        ? Math.min(
            300_000,
            10_000 +
              Math.ceil(
                Buffer.byteLength(JSON.stringify(payload)) / (64 * 1024),
              ) *
                1_000,
          )
        : ACK_TIMEOUT_MS;
    return new Promise<ActivityAck>((resolve) => {
      let settled = false;
      const finish = (ack: ActivityAck) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.off('disconnect', onDisconnect);
        resolve(ack);
      };
      const onDisconnect = () =>
        finish({ ok: false, retryable: 'disconnected' });
      const timeout = setTimeout(() => finish({ ok: false }), timeoutMs);
      socket.once('disconnect', onDisconnect);

      const handleAck = (ack?: ActivityAck) => {
        if (settled) {
          return;
        }
        if (this.options.debug) {
          console.log(`[execution-activity] ${eventName} ack:`, ack);
        }

        finish(ack ?? { ok: false });
      };

      if (payload === undefined) {
        socket.emit(eventName, handleAck);
        return;
      }

      socket.emit(eventName, payload, handleAck);
    });
  }

  private async connectWithFreshToken(): Promise<void> {
    const credentials = await this.options.auth.getCredentials();
    const namespace = '/executions/worker';
    const url = `${this.options.baseUrl}${namespace}`;
    const transports = ['websocket'];
    const reconnection = this.options.reconnection ?? true;
    const reconnectionAttempts = this.options.reconnectionAttempts ?? Infinity;
    const reconnectionDelay = this.options.reconnectionDelay ?? 1000;
    const reconnectionDelayMax = this.options.reconnectionDelayMax ?? 5000;
    const randomizationFactor = this.options.randomizationFactor ?? 0.5;

    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
    }

    if (this.options.debug) {
      console.log(`[execution-activity] connecting to ${url}`);
    }

    this.clearReconnectRetryTimer();

    this.socket = io(url, {
      transports,
      auth: { token: credentials.accessToken, workerVersion: WORKER_VERSION },
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      randomizationFactor,
    });

    this.socket.on('connect', () => {
      if (this.reconnectAttempts > 0) {
        console.log(
          `[execution-activity] reconnected after ${this.reconnectAttempts} attempts:`,
          this.socket?.id,
        );
      } else if (this.options.debug) {
        console.log('[execution-activity] connected:', this.socket?.id);
      }

      this.reconnectAttempts = 0;
      if (this.traceSpoolStarted) void this.traceSpool.resume();
      this.clearReconnectRetryTimer();
      this.scheduleTokenRefresh(credentials.expiresAt);
      this.startWorkerHeartbeatTimer();
      this.resolveInitialConnect?.();
      this.clearInitialConnectHandlers();
    });

    this.socket.on('disconnect', (reason) => {
      if (this.options.debug) {
        console.log('[execution-activity] disconnected:', reason);
      }

      this.clearTokenRefreshTimer();
      this.clearWorkerHeartbeatTimer();

      if (!this.started) {
        return;
      }

      this.scheduleReconnectRetry(
        false,
        reason === 'io server disconnect' ? 0 : RECONNECT_RETRY_DELAY_MS,
      );
    });

    this.socket.on(
      ExecutionWireEvents.WORKER_HARNESSES_REPORT_REQUESTED,
      () => {
        this.handleHarnessesReportRequested();
      },
    );

    this.socket.on(
      ExecutionWireEvents.TASK_EXECUTION_QUEUED,
      (event: TaskExecutionQueuedWireEvent) => {
        if (this.options.debug) {
          console.log(
            '[execution-activity] task queued event received:',
            event,
          );
        }
        this.options.onTaskQueued?.(event);
      },
    );

    this.socket.on(
      ExecutionWireEvents.EXECUTION_INTERRUPT_REQUEST,
      (event: ExecutionInterruptRequestWireEvent) => {
        if (this.options.debug) {
          console.log(
            '[execution-activity] execution interrupt request received:',
            event,
          );
        }
        this.options.onExecutionInterruptRequest?.(event);
      },
    );

    this.socket.on('connect_error', (err: Error) => {
      this.reconnectAttempts++;
      console.error(
        `[execution-activity] connect_error (attempt ${this.reconnectAttempts}):`,
        err.message,
      );

      if (this.started) {
        this.scheduleReconnectRetry(isAuthError(err));
      }
    });
  }

  private handleHarnessesReportRequested(): void {
    console.log('[execution-activity] worker harnesses report requested');
    // TODO: Check which harnesses and models are available, then report them via REST.
  }

  private scheduleTokenRefresh(expiresAtIso: string): void {
    this.clearTokenRefreshTimer();

    const refreshSkewMs =
      this.options.tokenRefreshSkewMs ?? DEFAULT_TOKEN_REFRESH_SKEW_MS;
    const expiresAtMs = Date.parse(expiresAtIso);
    if (Number.isNaN(expiresAtMs)) {
      return;
    }

    const delayMs = expiresAtMs - Date.now() - refreshSkewMs;
    if (delayMs <= 0) {
      void this.reconnectWithFreshToken(true).catch((error) => {
        this.handleReconnectError(error);
      });
      return;
    }

    this.tokenRefreshTimer = setTimeout(() => {
      void this.reconnectWithFreshToken(true).catch((error) => {
        this.handleReconnectError(error);
      });
    }, delayMs);
  }

  private clearTokenRefreshTimer(): void {
    if (!this.tokenRefreshTimer) {
      return;
    }
    clearTimeout(this.tokenRefreshTimer);
    this.tokenRefreshTimer = undefined;
  }

  private clearReconnectRetryTimer(): void {
    if (!this.reconnectRetryTimer) {
      this.reconnectRetryForceRefresh = false;
      return;
    }
    clearTimeout(this.reconnectRetryTimer);
    this.reconnectRetryTimer = undefined;
    this.reconnectRetryForceRefresh = false;
  }

  private startWorkerHeartbeatTimer(): void {
    this.clearWorkerHeartbeatTimer();
    this.workerHeartbeatTimer = setInterval(() => {
      void this.publishWorkerHeartbeat();
    }, WORKER_HEARTBEAT_INTERVAL_MS);
  }

  private clearWorkerHeartbeatTimer(): void {
    if (!this.workerHeartbeatTimer) {
      return;
    }
    clearInterval(this.workerHeartbeatTimer);
    this.workerHeartbeatTimer = undefined;
  }

  private clearInitialConnectHandlers(): void {
    this.resolveInitialConnect = undefined;
  }

  private async reconnectWithFreshToken(forceRefresh = false): Promise<void> {
    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    this.reconnectPromise = (async () => {
      try {
        if (forceRefresh) {
          await this.options.auth.refreshAccessToken();
        }

        // Socket replacement, including ACK cancellation, is handled in one place.
        await this.connectWithFreshToken();
      } finally {
        this.reconnectPromise = null;
      }
    })();

    return this.reconnectPromise;
  }

  private handleReconnectError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[execution-activity] reconnect failed: ${message}`);

    this.scheduleReconnectRetry();
  }

  private scheduleReconnectRetry(
    forceRefresh = false,
    delayMs = RECONNECT_RETRY_DELAY_MS,
  ): void {
    if (!this.started) {
      return;
    }

    this.reconnectRetryForceRefresh ||= forceRefresh;

    if (this.reconnectRetryTimer) {
      return;
    }

    this.reconnectRetryTimer = setTimeout(() => {
      const shouldForceRefresh = this.reconnectRetryForceRefresh;
      this.reconnectRetryTimer = undefined;
      this.reconnectRetryForceRefresh = false;
      this.reconnectAttempts++;
      console.log(
        `[execution-activity] reconnect attempt ${this.reconnectAttempts}`,
      );
      void this.reconnectWithFreshToken(shouldForceRefresh).catch(
        (retryError) => {
          this.handleReconnectError(retryError);
        },
      );
    }, delayMs);
  }
}

function isAuthError(error: Error): boolean {
  return /401|403|unauthori[sz]ed|forbidden|token/i.test(error.message);
}
