import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Socket } from 'socket.io';
import {
  ExecutionWireEvents,
  type PostExecutionHeartbeatPayload,
  type PostExecutionActivityPayload,
} from '@taico/events';
import { WsAccessTokenGuard } from '../auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from '../auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { WorkersScopes } from '../executions/workers.scopes';
import { ExecutionActivityService } from './execution-activity.service';
import { ActiveTaskExecutionNotFoundError } from './errors/executions-v2.errors';
import { AuthContext } from '../auth/guards/context/auth-context.types';

const SOCKET_AUTH_EXPIRY_SKEW_MS = 1_000;

@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(WorkersScopes.CONNECT.id)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/executions-v2/worker',
})
export class ExecutionsV2WorkerGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ExecutionsV2WorkerGateway.name);
  private readonly socketExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly executionActivityService: ExecutionActivityService,
  ) {}

  afterInit() {
    this.logger.log('Executions-v2 worker WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Worker client connected: ${client.id}`);
    this.scheduleTokenExpiryDisconnect(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Worker client disconnected: ${client.id}`);
    this.clearTokenExpiryDisconnect(client.id);
  }

  @SubscribeMessage(ExecutionWireEvents.EXECUTION_ACTIVITY_POST)
  async postExecutionActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PostExecutionActivityPayload,
  ) {
    if (!body?.executionId) {
      return { ok: false, error: 'executionId required' };
    }

    try {
      await this.executionActivityService.publishActivity({
        executionId: body.executionId,
        kind: body.kind,
        message: body.message,
        ts: body.ts,
        runnerSessionId: body.runnerSessionId,
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof ActiveTaskExecutionNotFoundError) {
        return { ok: false, error: error.message };
      }

      this.logger.error({
        message: 'Failed to forward execution activity',
        socketId: client.id,
        executionId: body.executionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, error: 'internal error' };
    }
  }

  @SubscribeMessage(ExecutionWireEvents.EXECUTION_HEARTBEAT_POST)
  async postExecutionHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PostExecutionHeartbeatPayload,
  ) {
    if (!body?.executionId) {
      return { ok: false, error: 'executionId required' };
    }

    try {
      await this.executionActivityService.touchHeartbeat({
        executionId: body.executionId,
      });
      return { ok: true };
    } catch (error) {
      this.logger.error({
        message: 'Failed to process execution heartbeat',
        socketId: client.id,
        executionId: body.executionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, error: 'internal error' };
    }
  }

  private scheduleTokenExpiryDisconnect(client: Socket): void {
    this.clearTokenExpiryDisconnect(client.id);

    const auth = client.data.auth as AuthContext | undefined;
    const expSeconds = auth?.claims?.exp;
    if (!expSeconds) {
      return;
    }

    const disconnectAtMs = expSeconds * 1000 - SOCKET_AUTH_EXPIRY_SKEW_MS;
    const delayMs = disconnectAtMs - Date.now();
    if (delayMs <= 0) {
      client.disconnect(true);
      return;
    }

    const timer = setTimeout(() => {
      this.logger.log(`Disconnecting worker socket ${client.id} because its auth token expired`);
      client.disconnect(true);
    }, delayMs);

    this.socketExpiryTimers.set(client.id, timer);
  }

  private clearTokenExpiryDisconnect(socketId: string): void {
    const timer = this.socketExpiryTimers.get(socketId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.socketExpiryTimers.delete(socketId);
  }
}
