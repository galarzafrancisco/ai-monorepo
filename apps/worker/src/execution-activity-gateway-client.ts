import { io, Socket } from 'socket.io-client';
import {
  ExecutionWireEvents,
  type PostExecutionActivityPayload,
} from '@taico/events';
import { WorkerAuth } from './auth/worker-auth.js';

const DEFAULT_TOKEN_REFRESH_SKEW_MS = 60_000;
const ACK_TIMEOUT_MS = 5_000;
const EXECUTION_HEARTBEAT_POST_EVENT = 'execution.heartbeat.post';

type PostExecutionHeartbeatPayload = {
  executionId: string;
};

type ActivityAck = {
  ok: boolean;
  error?: string;
};

export type ExecutionActivityGatewayClientOptions = {
  baseUrl: string;
  auth: WorkerAuth;
  debug?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  randomizationFactor?: number;
  tokenRefreshSkewMs?: number;
};

export class ExecutionActivityGatewayClient {
  private socket?: Socket;
  private started = false;
  private reconnectAttempts = 0;
  private tokenRefreshTimer?: ReturnType<typeof setTimeout>;
  private reconnectPromise: Promise<void> | null = null;
  private resolveInitialConnect?: () => void;
  private rejectInitialConnect?: (error: unknown) => void;

  constructor(
    private readonly options: ExecutionActivityGatewayClientOptions,
  ) {}

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    const initialConnectPromise = new Promise<void>((resolve, reject) => {
      this.resolveInitialConnect = resolve;
      this.rejectInitialConnect = reject;
    });

    await this.connectWithFreshToken();
    await initialConnectPromise;
  }

  async stop(): Promise<void> {
    this.started = false;
    this.clearTokenRefreshTimer();
    this.clearInitialConnectHandlers();

    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = undefined;
    socket.removeAllListeners();
    socket.disconnect();
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
      EXECUTION_HEARTBEAT_POST_EVENT,
      payload,
    );
  }

  private async emitWithAck(
    eventName: string,
    payload: PostExecutionActivityPayload | PostExecutionHeartbeatPayload,
  ): Promise<boolean> {
    if (!this.socket || !this.socket.connected) {
      if (this.options.debug) {
        console.warn(
          `[execution-activity] ${eventName} called while disconnected`,
          payload,
        );
      }
      return false;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(false);
      }, ACK_TIMEOUT_MS);

      this.socket!.emit(
        eventName,
        payload,
        (ack?: ActivityAck) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);

          if (this.options.debug) {
            console.log(`[execution-activity] ${eventName} ack:`, ack);
          }

          resolve(Boolean(ack?.ok));
        },
      );
    });
  }

  private async connectWithFreshToken(): Promise<void> {
    const credentials = await this.options.auth.getCredentials();
    const namespace = '/executions-v2/worker';
    const url = `${this.options.baseUrl}${namespace}`;
    const transports = ['websocket'];
    const reconnection = this.options.reconnection ?? true;
    const reconnectionAttempts = this.options.reconnectionAttempts ?? Infinity;
    const reconnectionDelay = this.options.reconnectionDelay ?? 1000;
    const reconnectionDelayMax = this.options.reconnectionDelayMax ?? 5000;
    const randomizationFactor = this.options.randomizationFactor ?? 0.5;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    if (this.options.debug) {
      console.log(`[execution-activity] connecting to ${url}`);
    }

    this.socket = io(url, {
      transports,
      auth: { token: credentials.accessToken },
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
      this.scheduleTokenRefresh(credentials.expiresAt);
      this.resolveInitialConnect?.();
      this.clearInitialConnectHandlers();
    });

    this.socket.on('disconnect', (reason) => {
      if (this.options.debug) {
        console.log('[execution-activity] disconnected:', reason);
      }

      this.clearTokenRefreshTimer();

      if (!this.started) {
        return;
      }

      if (reason === 'io server disconnect') {
        void this.reconnectWithFreshToken();
      }
    });

    this.socket.on('connect_error', (err: Error) => {
      this.reconnectAttempts++;
      console.error(
        `[execution-activity] connect_error (attempt ${this.reconnectAttempts}):`,
        err.message,
      );

      if (!this.socket?.connected) {
        this.rejectInitialConnect?.(err);
        this.clearInitialConnectHandlers();
      }

      if (isAuthError(err)) {
        void this.reconnectWithFreshToken(true);
      }
    });
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
      void this.reconnectWithFreshToken(true);
      return;
    }

    this.tokenRefreshTimer = setTimeout(() => {
      void this.reconnectWithFreshToken(true);
    }, delayMs);
  }

  private clearTokenRefreshTimer(): void {
    if (!this.tokenRefreshTimer) {
      return;
    }
    clearTimeout(this.tokenRefreshTimer);
    this.tokenRefreshTimer = undefined;
  }

  private clearInitialConnectHandlers(): void {
    this.resolveInitialConnect = undefined;
    this.rejectInitialConnect = undefined;
  }

  private async reconnectWithFreshToken(
    forceRefresh = false,
  ): Promise<void> {
    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    this.reconnectPromise = (async () => {
      try {
        if (forceRefresh) {
          await this.options.auth.refreshAccessToken();
        }

        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = undefined;
        }

        await this.connectWithFreshToken();
      } finally {
        this.reconnectPromise = null;
      }
    })();

    return this.reconnectPromise;
  }
}

function isAuthError(error: Error): boolean {
  return /401|403|unauthori[sz]ed|forbidden|token/i.test(error.message);
}
