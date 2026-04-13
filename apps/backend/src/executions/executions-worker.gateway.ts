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
import { Server, Socket } from 'socket.io';
import * as cookie from 'cookie';
import {
  ExecutionWireEvents,
  type PostExecutionHeartbeatPayload,
  type PostExecutionActivityPayload,
} from '@taico/events';
import { WsAccessTokenGuard } from '../auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from '../auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { WorkersScopes } from './workers.scopes';
import { ExecutionActivityService } from './execution-activity.service';
import { ActiveTaskExecutionNotFoundError } from './errors/executions.errors';
import { AuthContext } from '../auth/guards/context/auth-context.types';
import { WorkersService } from '../workers/workers.service';
import { AccessTokenValidationService } from '../auth/guards/validation/access-token-validation.service';
import { tokenFromHeaders } from '../auth/guards/extractors/token-header.extractor';
import { tokenFromCookies } from '../auth/guards/extractors/token-cookie.extractor';

const SOCKET_AUTH_EXPIRY_SKEW_MS = 1_000;

@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(WorkersScopes.CONNECT.id)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/executions/worker',
})
export class ExecutionsWorkerGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ExecutionsWorkerGateway.name);
  private readonly socketExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly harnessReportRequestedSocketIds = new Set<string>();

  constructor(
    private readonly executionActivityService: ExecutionActivityService,
    private readonly workersService: WorkersService,
    private readonly accessTokenValidationService: AccessTokenValidationService,
  ) {}

  afterInit(server: Server) {
    server.use((client, next) => {
      void this.authenticateWorkerSocket(client)
        .then(() => next())
        .catch((error: unknown) => {
          this.logger.warn({
            message: 'Worker socket authentication failed',
            socketId: client.id,
            error: error instanceof Error ? error.message : String(error),
          });
          next(new Error('unauthorized'));
        });
    });
    this.logger.log('Executions worker WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Worker client connected: ${client.id}`);
    void this.recordAuthenticatedWorkerSeen(client).catch((error: unknown) => {
      this.logger.warn({
        message: 'Failed to record worker connection liveness',
        socketId: client.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Worker client disconnected: ${client.id}`);
    this.clearTokenExpiryDisconnect(client.id);
    this.harnessReportRequestedSocketIds.delete(client.id);
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
      await this.recordAuthenticatedWorkerSeen(client);
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

  @SubscribeMessage(ExecutionWireEvents.WORKER_HEARTBEAT_POST)
  async postWorkerHeartbeat(@ConnectedSocket() client: Socket) {
    try {
      await this.recordAuthenticatedWorkerSeen(client);
      return { ok: true };
    } catch (error) {
      this.logger.error({
        message: 'Failed to process worker heartbeat',
        socketId: client.id,
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

  private async recordWorkerSeen(client: Socket): Promise<boolean> {
    const oauthClientId = this.getOauthClientId(client);
    if (!oauthClientId) {
      return false;
    }

    await this.workersService.recordWorkerSeen({ oauthClientId });
    return true;
  }

  private async recordAuthenticatedWorkerSeen(client: Socket): Promise<void> {
    if (!(await this.recordWorkerSeen(client))) {
      return;
    }

    this.scheduleTokenExpiryDisconnect(client);
    this.requestWorkerHarnessesReport(client);
  }

  private getOauthClientId(client: Socket): string | null {
    const auth = client.data.auth as AuthContext | undefined;
    const oauthClientId = auth?.claims?.client_id;
    if (!oauthClientId) {
      this.logger.warn(
        `Worker socket ${client.id} is missing client_id in auth claims`,
      );
      return null;
    }

    return oauthClientId;
  }

  private requestWorkerHarnessesReport(client: Socket): void {
    if (this.harnessReportRequestedSocketIds.has(client.id)) {
      return;
    }

    this.harnessReportRequestedSocketIds.add(client.id);
    client.emit(ExecutionWireEvents.WORKER_HARNESSES_REPORT_REQUESTED);
  }

  private async authenticateWorkerSocket(client: Socket): Promise<void> {
    const token = this.getSocketToken(client);
    if (!token) {
      throw new Error('missing token');
    }

    const claims = await this.accessTokenValidationService.validateAccessToken(token);
    if (!claims.scope.includes(WorkersScopes.CONNECT.id)) {
      throw new Error(`missing required scope ${WorkersScopes.CONNECT.id}`);
    }

    const authContext: AuthContext = {
      token,
      claims,
      scopes: claims.scope,
      subject: claims.sub,
    };
    client.data.auth = authContext;
  }

  private getSocketToken(client: Socket): string | null {
    return (
      client.handshake.auth?.token ||
      tokenFromHeaders(client.handshake.headers) ||
      tokenFromCookies(cookie.parse(client.handshake.headers.cookie || ''))
    );
  }
}
