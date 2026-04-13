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
import {
  WorkerWireEvents,
} from '@taico/events';
import type {
  WorkerHeartbeatPayload,
  WorkerHeartbeatResponse,
  WorkerHelloResponse,
} from '@taico/events';
import { Socket } from 'socket.io';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { AuthContext } from 'src/auth/guards/context/auth-context.types';
import { WorkersScopes } from 'src/executions/workers.scopes';
import { WorkersService } from './workers.service';

const WORKER_SESSION_KEY = 'workerSessionId';

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
  private readonly logger = new Logger(WorkersGateway.name);

  constructor(private readonly workersService: WorkersService) {}

  afterInit() {
    this.logger.log('Workers WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Worker client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Worker client disconnected: ${client.id}`);
  }

  @SubscribeMessage(WorkerWireEvents.WORKER_HELLO)
  async workerHello(
    @ConnectedSocket() client: Socket,
  ): Promise<WorkerHelloResponse> {
    const oauthClientId = this.getOauthClientId(client);

    if (oauthClientId) {
      await this.workersService.recordWorkerSeen({ oauthClientId });
    }

    const sessionId = client.id;
    client.data[WORKER_SESSION_KEY] = sessionId;

    return {
      sessionId,
      serverTime: Date.now(),
    };
  }

  @SubscribeMessage(WorkerWireEvents.WORKER_HEARTBEAT)
  async workerHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WorkerHeartbeatPayload,
  ): Promise<WorkerHeartbeatResponse> {
    const expectedSessionId = client.data[WORKER_SESSION_KEY] as
      | string
      | undefined;

    if (!expectedSessionId || body?.sessionId !== expectedSessionId) {
      return {
        ok: false,
        serverTime: Date.now(),
      };
    }

    const oauthClientId = this.getOauthClientId(client);
    if (!oauthClientId) {
      return {
        ok: false,
        serverTime: Date.now(),
      };
    }

    await this.workersService.recordWorkerSeen({ oauthClientId });

    return {
      ok: true,
      serverTime: Date.now(),
    };
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
}
