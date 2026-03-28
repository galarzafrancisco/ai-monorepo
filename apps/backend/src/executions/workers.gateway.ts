import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayInit,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import {
  WorkerWireEvents,
  type WorkerHelloPayload,
  type WorkerHelloResponse,
  type WorkerHeartbeatPayload,
  type WorkerHeartbeatResponse,
  type RunStartedPayload,
  type RunCompletedPayload,
  type RunFailedPayload,
  type RunLifecycleAck,
  type RunAssignedWireEvent,
  type StopRequestedWireEvent,
} from '@taico/events';
import { WsAccessTokenGuard } from '../auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from '../auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { WorkerSessionService } from './worker-session.service';
import { ExecutionClaimService } from './execution-claim.service';
import { ExecutionsService } from './executions.service';
import { TaskExecutionStatus } from './enums';
import { WorkersScopes } from './workers.scopes';
import { type AuthContext } from '../auth/guards/context/auth-context.types';

/**
 * WebSocket gateway for Workers domain.
 *
 * Manages persistent WebSocket connections from worker processes,
 * handling worker registration, heartbeats, run lifecycle updates,
 * and dispatching execution assignments and stop requests.
 *
 * This gateway establishes the typed communication layer that the
 * execution dispatch and orchestration system relies on.
 */
@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(WorkersScopes.CONNECT.id)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/workers',
})
export class WorkersGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WorkersGateway.name);

  // Map socket.id -> worker session ID for tracking
  private readonly socketToSession = new Map<string, string>();

  constructor(
    private readonly workerSessionService: WorkerSessionService,
    private readonly executionClaimService: ExecutionClaimService,
    private readonly executionsService: ExecutionsService,
  ) {}

  afterInit() {
    this.logger.log('Workers WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Worker client connecting: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Worker client disconnected: ${client.id}`);

    const sessionId = this.socketToSession.get(client.id);
    if (sessionId) {
      await this.workerSessionService.markOffline(sessionId);
      this.socketToSession.delete(client.id);

      this.logger.log({
        message: 'Worker session marked offline on disconnect',
        sessionId,
        socketId: client.id,
      });
    }
  }

  /**
   * Handle worker hello message.
   *
   * Workers send this on connection to register themselves with metadata.
   * Creates a WorkerSession record and returns the session ID.
   */
  @SubscribeMessage(WorkerWireEvents.WORKER_HELLO)
  async handleHello(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WorkerHelloPayload,
  ): Promise<WorkerHelloResponse> {
    const authContext = client.data.auth as AuthContext;
    const oauthClientId = authContext.subject; // The OAuth client ID is the subject of the access token

    this.logger.log({
      message: 'Worker hello received',
      socketId: client.id,
      oauthClientId,
      hostname: payload.hostname,
      pid: payload.pid,
      version: payload.version,
    });

    const session = await this.workerSessionService.registerSession({
      oauthClientId,
      hostname: payload.hostname,
      pid: payload.pid,
      version: payload.version,
      capabilities: payload.capabilities,
      lastSeenIp: client.handshake.address,
    });

    // Track the mapping from socket to session
    this.socketToSession.set(client.id, session.id);

    // Join a room specific to this session for targeted messaging
    client.join(`session:${session.id}`);

    this.logger.log({
      message: 'Worker session registered',
      sessionId: session.id,
      socketId: client.id,
      oauthClientId,
    });

    return {
      sessionId: session.id,
      serverTime: Date.now(),
    };
  }

  /**
   * Handle worker heartbeat message.
   *
   * Workers send this periodically to indicate they're still alive.
   * Updates the lastHeartbeatAt timestamp.
   */
  @SubscribeMessage(WorkerWireEvents.WORKER_HEARTBEAT)
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WorkerHeartbeatPayload,
  ): Promise<WorkerHeartbeatResponse> {
    // Validate session ownership to prevent spoofing
    const registeredSessionId = this.socketToSession.get(client.id);
    if (!registeredSessionId || registeredSessionId !== payload.sessionId) {
      this.logger.warn({
        message: 'Heartbeat session mismatch - possible spoofing attempt',
        socketId: client.id,
        registeredSessionId,
        payloadSessionId: payload.sessionId,
      });
      return { ok: false, serverTime: Date.now() };
    }

    const updated = await this.workerSessionService.updateHeartbeat({
      sessionId: payload.sessionId,
      lastSeenIp: client.handshake.address,
    });

    if (!updated) {
      this.logger.warn({
        message: 'Heartbeat for unknown session',
        sessionId: payload.sessionId,
        socketId: client.id,
      });
      return { ok: false, serverTime: Date.now() };
    }

    this.logger.debug({
      message: 'Worker heartbeat processed',
      sessionId: payload.sessionId,
    });

    return {
      ok: true,
      serverTime: Date.now(),
    };
  }

  /**
   * Handle run started message.
   *
   * Worker reports that it has started executing a task.
   * Updates the TaskExecution status to RUNNING.
   */
  @SubscribeMessage(WorkerWireEvents.RUN_STARTED)
  async handleRunStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RunStartedPayload,
  ): Promise<RunLifecycleAck> {
    // Validate session ownership to prevent spoofing
    const registeredSessionId = this.socketToSession.get(client.id);
    if (!registeredSessionId || registeredSessionId !== payload.sessionId) {
      this.logger.warn({
        message: 'Run started session mismatch - possible spoofing attempt',
        socketId: client.id,
        registeredSessionId,
        payloadSessionId: payload.sessionId,
        executionId: payload.executionId,
      });
      return {
        ok: false,
        executionId: payload.executionId,
      };
    }

    this.logger.log({
      message: 'Run started',
      executionId: payload.executionId,
      sessionId: payload.sessionId,
      socketId: client.id,
    });

    try {
      const started = await this.executionClaimService.startExecution(
        payload.executionId,
        payload.sessionId,
      );

      if (!started) {
        this.logger.warn({
          message: 'Failed to start execution - ownership or state check failed',
          executionId: payload.executionId,
          sessionId: payload.sessionId,
        });
        return {
          ok: false,
          executionId: payload.executionId,
        };
      }

      return {
        ok: true,
        executionId: payload.executionId,
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to mark execution as started',
        executionId: payload.executionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ok: false,
        executionId: payload.executionId,
      };
    }
  }

  /**
   * Handle run completed message.
   *
   * Worker reports that task execution finished successfully.
   * Updates the TaskExecution status to COMPLETED.
   */
  @SubscribeMessage(WorkerWireEvents.RUN_COMPLETED)
  async handleRunCompleted(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RunCompletedPayload,
  ): Promise<RunLifecycleAck> {
    // Validate session ownership to prevent spoofing
    const registeredSessionId = this.socketToSession.get(client.id);
    if (!registeredSessionId || registeredSessionId !== payload.sessionId) {
      this.logger.warn({
        message: 'Run completed session mismatch - possible spoofing attempt',
        socketId: client.id,
        registeredSessionId,
        payloadSessionId: payload.sessionId,
        executionId: payload.executionId,
      });
      return {
        ok: false,
        executionId: payload.executionId,
      };
    }

    this.logger.log({
      message: 'Run completed',
      executionId: payload.executionId,
      sessionId: payload.sessionId,
      socketId: client.id,
    });

    try {
      const completed = await this.executionClaimService.completeExecution(
        payload.executionId,
        payload.sessionId,
        new Date(payload.completedAt),
      );

      if (!completed) {
        this.logger.warn({
          message: 'Failed to complete execution - ownership or state check failed',
          executionId: payload.executionId,
          sessionId: payload.sessionId,
        });
        return {
          ok: false,
          executionId: payload.executionId,
        };
      }

      return {
        ok: true,
        executionId: payload.executionId,
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to mark execution as completed',
        executionId: payload.executionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ok: false,
        executionId: payload.executionId,
      };
    }
  }

  /**
   * Handle run failed message.
   *
   * Worker reports that task execution failed.
   * Updates the TaskExecution status to FAILED with failure reason.
   */
  @SubscribeMessage(WorkerWireEvents.RUN_FAILED)
  async handleRunFailed(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RunFailedPayload,
  ): Promise<RunLifecycleAck> {
    // Validate session ownership to prevent spoofing
    const registeredSessionId = this.socketToSession.get(client.id);
    if (!registeredSessionId || registeredSessionId !== payload.sessionId) {
      this.logger.warn({
        message: 'Run failed session mismatch - possible spoofing attempt',
        socketId: client.id,
        registeredSessionId,
        payloadSessionId: payload.sessionId,
        executionId: payload.executionId,
      });
      return {
        ok: false,
        executionId: payload.executionId,
      };
    }

    this.logger.log({
      message: 'Run failed',
      executionId: payload.executionId,
      sessionId: payload.sessionId,
      reason: payload.reason,
      socketId: client.id,
    });

    try {
      const failed = await this.executionClaimService.failExecution(
        payload.executionId,
        payload.sessionId,
        new Date(payload.failedAt),
        payload.reason ?? 'Unknown failure',
      );

      if (!failed) {
        this.logger.warn({
          message: 'Failed to fail execution - ownership or state check failed',
          executionId: payload.executionId,
          sessionId: payload.sessionId,
        });
        return {
          ok: false,
          executionId: payload.executionId,
        };
      }

      return {
        ok: true,
        executionId: payload.executionId,
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to mark execution as failed',
        executionId: payload.executionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ok: false,
        executionId: payload.executionId,
      };
    }
  }

  /**
   * Emit a run assignment to a specific worker session.
   *
   * Called by the execution dispatch service when assigning work to a worker.
   *
   * @param sessionId - The worker session ID to send the assignment to
   * @param event - The run assignment event
   */
  emitRunAssigned(sessionId: string, event: RunAssignedWireEvent): void {
    this.server.to(`session:${sessionId}`).emit(WorkerWireEvents.RUN_ASSIGNED, event);

    this.logger.log({
      message: 'Run assigned emitted',
      sessionId,
      executionId: event.executionId,
      taskId: event.taskId,
    });
  }

  /**
   * Emit a stop request to a specific worker session.
   *
   * Called when a user or system requests stopping a running execution.
   *
   * @param sessionId - The worker session ID to send the stop request to
   * @param event - The stop request event
   */
  emitStopRequested(sessionId: string, event: StopRequestedWireEvent): void {
    this.server.to(`session:${sessionId}`).emit(WorkerWireEvents.STOP_REQUESTED, event);

    this.logger.log({
      message: 'Stop requested emitted',
      sessionId,
      executionId: event.executionId,
      taskId: event.taskId,
      reason: event.reason,
    });
  }
}
