/*
Socket.IO transport for worker-backend communication.

Handles connection, registration, heartbeat, and run lifecycle messaging
with resilient reconnect logic.
*/

import { io, Socket } from 'socket.io-client';
import * as os from 'os';
import {
  WorkerWireEvents,
  WorkerHelloPayload,
  WorkerHelloResponse,
  WorkerHeartbeatPayload,
  WorkerHeartbeatResponse,
  RunStartedPayload,
  RunCompletedPayload,
  RunFailedPayload,
  RunLifecycleAck,
  RunAssignedWireEvent,
  StopRequestedWireEvent,
} from '@taico/events';

export type RunAssignedHandler = (event: RunAssignedWireEvent) => void;
export type StopRequestedHandler = (event: StopRequestedWireEvent) => void;

export interface WorkerGatewayClientOptions {
  baseUrl: string;
  accessToken: string;
  version?: string;
  capabilities?: string[];
  debug?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  randomizationFactor?: number;
  heartbeatIntervalMs?: number;
}

/**
 * Client for connecting workers to the backend /workers gateway.
 *
 * Responsibilities:
 * - Establish and maintain WebSocket connection with retry logic
 * - Send hello message on connect to register worker session
 * - Send periodic heartbeats to maintain session liveness
 * - Report run lifecycle updates (started, completed, failed)
 * - Listen for run assignments and stop requests from backend
 *
 * This provides the resilient communication layer workers need to
 * participate in backend-orchestrated execution.
 */
export class WorkerGatewayClient {
  private socket?: Socket;
  private sessionId?: string;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private started = false;
  private reconnectAttempts = 0;
  private resolveInitialHello?: () => void;
  private rejectInitialHello?: (error: unknown) => void;

  private runAssignedHandlers: RunAssignedHandler[] = [];
  private stopRequestedHandlers: StopRequestedHandler[] = [];

  constructor(private readonly options: WorkerGatewayClientOptions) {}

  /**
   * Register a handler for run assigned events.
   */
  onRunAssigned(handler: RunAssignedHandler): void {
    this.runAssignedHandlers.push(handler);
  }

  /**
   * Register a handler for stop requested events.
   */
  onStopRequested(handler: StopRequestedHandler): void {
    this.stopRequestedHandlers.push(handler);
  }

  /**
   * Start the worker gateway client.
   * Connects to the backend and registers the worker session.
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const initialHelloPromise = new Promise<void>((resolve, reject) => {
      this.resolveInitialHello = resolve;
      this.rejectInitialHello = reject;
    });

    const namespace = '/workers';
    const transports = ['websocket'];
    const reconnection = this.options.reconnection ?? true;
    const reconnectionAttempts = this.options.reconnectionAttempts ?? Infinity;
    const reconnectionDelay = this.options.reconnectionDelay ?? 1000;
    const reconnectionDelayMax = this.options.reconnectionDelayMax ?? 5000;
    const randomizationFactor = this.options.randomizationFactor ?? 0.5;

    const url = `${this.options.baseUrl}${namespace}`;
    if (this.options.debug) console.log(`[worker-gateway] connecting to ${url}`);

    this.socket = io(url, {
      transports,
      auth: { token: this.options.accessToken },
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      randomizationFactor,
    });

    // ----- lifecycle -----
    this.socket.on('connect', async () => {
      if (this.reconnectAttempts > 0) {
        console.log(
          `[worker-gateway] reconnected after ${this.reconnectAttempts} attempts:`,
          this.socket?.id,
        );
      } else {
        if (this.options.debug)
          console.log('[worker-gateway] connected:', this.socket?.id);
      }

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      try {
        await this.sendHello();
        this.startHeartbeat();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error('[worker-gateway] hello failed:', reason);
        if (!this.sessionId) {
          this.rejectInitialHello?.(error);
          this.clearInitialHelloHandlers();
        }
      }
    });

    this.socket.on('disconnect', (reason) => {
      if (this.options.debug)
        console.log('[worker-gateway] disconnected:', reason);

      this.stopHeartbeat();

      // Clear session ID on disconnect
      this.sessionId = undefined;

      // Only log reconnection info if we're going to try reconnecting
      if (reconnection && reason !== 'io client disconnect') {
        console.log('[worker-gateway] will attempt to reconnect...');
      }
    });

    this.socket.on('connect_error', (err: any) => {
      this.reconnectAttempts++;
      console.error(
        `[worker-gateway] connect_error (attempt ${this.reconnectAttempts}):`,
        err?.message ?? err,
      );
      if (this.options.debug) console.error(err);

      if (!this.sessionId) {
        this.rejectInitialHello?.(err);
        this.clearInitialHelloHandlers();
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      if (this.options.debug)
        console.log(`[worker-gateway] reconnect_attempt ${attemptNumber}`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error(
        '[worker-gateway] reconnect_failed: max reconnection attempts reached',
      );
    });

    // ----- events we care about -----
    this.socket.on(
      WorkerWireEvents.RUN_ASSIGNED,
      (event: RunAssignedWireEvent) => {
        if (this.options.debug)
          console.log('[worker-gateway] run assigned:', event);
        this.emitRunAssigned(event);
      },
    );

    this.socket.on(
      WorkerWireEvents.STOP_REQUESTED,
      (event: StopRequestedWireEvent) => {
        if (this.options.debug)
          console.log('[worker-gateway] stop requested:', event);
        this.emitStopRequested(event);
      },
    );

    await initialHelloPromise;
  }

  /**
   * Stop the worker gateway client.
   * Disconnects from the backend and cleans up resources.
   */
  async stop(): Promise<void> {
    this.started = false;

    this.stopHeartbeat();
    this.clearInitialHelloHandlers();

    if (!this.socket) return;

    const s = this.socket;
    this.socket = undefined;

    // remove listeners to avoid leaks if restarted
    s.removeAllListeners();
    s.disconnect();
  }

  /**
   * Send hello message to register worker session.
   */
  private async sendHello(): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      console.warn('[worker-gateway] cannot send hello: not connected');
      return;
    }

    const payload: WorkerHelloPayload = {
      hostname: os.hostname(),
      pid: process.pid,
      version: this.options.version,
      capabilities: this.options.capabilities,
    };

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error('Hello acknowledgment timeout'));
      }, 10000);

      this.socket!.emit(
        WorkerWireEvents.WORKER_HELLO,
        payload,
        (response?: WorkerHelloResponse) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);

          if (this.options.debug)
            console.log('[worker-gateway] hello response:', response);

          if (!response?.sessionId) {
            reject(new Error('Hello acknowledgment missing sessionId'));
            return;
          }

          this.sessionId = response.sessionId;
          console.log(`[worker-gateway] registered session: ${this.sessionId}`);
          this.resolveInitialHello?.();
          this.clearInitialHelloHandlers();
          resolve();
        },
      );
    });
  }

  /**
   * Start sending periodic heartbeats.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    const intervalMs = this.options.heartbeatIntervalMs ?? 30000; // Default 30s

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
  }

  /**
   * Stop sending periodic heartbeats.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Send a heartbeat message.
   */
  private sendHeartbeat(): void {
    if (!this.socket || !this.socket.connected || !this.sessionId) {
      if (this.options.debug)
        console.warn('[worker-gateway] cannot send heartbeat: not ready');
      return;
    }

    const payload: WorkerHeartbeatPayload = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
    };

    this.socket.emit(
      WorkerWireEvents.WORKER_HEARTBEAT,
      payload,
      (response: WorkerHeartbeatResponse) => {
        if (this.options.debug)
          console.log('[worker-gateway] heartbeat response:', response);

        if (!response.ok) {
          console.warn(
            '[worker-gateway] heartbeat rejected by server, re-sending hello',
          );
          void this.sendHello();
        }
      },
    );
  }

  private clearInitialHelloHandlers(): void {
    this.resolveInitialHello = undefined;
    this.rejectInitialHello = undefined;
  }

  /**
   * Report that a run has started.
   */
  async reportRunStarted(executionId: string): Promise<void> {
    if (!this.socket || !this.socket.connected || !this.sessionId) {
      console.warn('[worker-gateway] cannot report run started: not ready');
      return;
    }

    const payload: RunStartedPayload = {
      executionId,
      sessionId: this.sessionId,
      startedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        WorkerWireEvents.RUN_STARTED,
        payload,
        (ack: RunLifecycleAck) => {
          if (this.options.debug)
            console.log('[worker-gateway] run started ack:', ack);

          if (ack.ok) {
            resolve();
          } else {
            reject(
              new Error(`Run started rejected for execution ${executionId}`),
            );
          }
        },
      );
    });
  }

  /**
   * Report that a run has completed successfully.
   */
  async reportRunCompleted(executionId: string): Promise<void> {
    if (!this.socket || !this.socket.connected || !this.sessionId) {
      console.warn('[worker-gateway] cannot report run completed: not ready');
      return;
    }

    const payload: RunCompletedPayload = {
      executionId,
      sessionId: this.sessionId,
      completedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        WorkerWireEvents.RUN_COMPLETED,
        payload,
        (ack: RunLifecycleAck) => {
          if (this.options.debug)
            console.log('[worker-gateway] run completed ack:', ack);

          if (ack.ok) {
            resolve();
          } else {
            reject(
              new Error(`Run completed rejected for execution ${executionId}`),
            );
          }
        },
      );
    });
  }

  /**
   * Report that a run has failed.
   */
  async reportRunFailed(executionId: string, reason?: string): Promise<void> {
    if (!this.socket || !this.socket.connected || !this.sessionId) {
      console.warn('[worker-gateway] cannot report run failed: not ready');
      return;
    }

    const payload: RunFailedPayload = {
      executionId,
      sessionId: this.sessionId,
      failedAt: new Date().toISOString(),
      reason,
    };

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        WorkerWireEvents.RUN_FAILED,
        payload,
        (ack: RunLifecycleAck) => {
          if (this.options.debug)
            console.log('[worker-gateway] run failed ack:', ack);

          if (ack.ok) {
            resolve();
          } else {
            reject(
              new Error(`Run failed rejected for execution ${executionId}`),
            );
          }
        },
      );
    });
  }

  private emitRunAssigned(event: RunAssignedWireEvent): void {
    for (const handler of this.runAssignedHandlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[worker-gateway] run assigned handler error:', err);
      }
    }
  }

  private emitStopRequested(event: StopRequestedWireEvent): void {
    for (const handler of this.stopRequestedHandlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[worker-gateway] stop requested handler error:', err);
      }
    }
  }

  /**
   * Get the current session ID.
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Check if the client is connected and has a session.
   */
  isReady(): boolean {
    return Boolean(this.socket?.connected && this.sessionId);
  }
}
