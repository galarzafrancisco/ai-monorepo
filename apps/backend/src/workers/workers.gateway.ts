import {
  ConnectedSocket,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkerSeenEvent } from './events/workers.events';
import { WorkerWireEvents } from '@taico/events';
import type { WorkerSeenWireEvent } from '@taico/events';
import { WorkerResponseDto } from './dto/http/worker-response.dto';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { WorkersScopes } from 'src/executions/workers.scopes';

const WORKERS_ROOM = 'workers';

/**
 * WebSocket gateway for Workers domain.
 *
 * Acts as a transport adapter that:
 * 1. Listens to internal domain events (Symbol-based)
 * 2. Maps domain entities to DTOs
 * 3. Emits stable wire events to clients
 *
 * This decouples the service layer from transport concerns,
 * similar to how HTTP controllers map entities to response DTOs.
 */
@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(WorkersScopes.READ.id)
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

  private logger = new Logger(WorkersGateway.name);

  afterInit() {
    this.logger.log('Workers WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to workers namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from workers namespace: ${client.id}`);
  }

  @SubscribeMessage('workers.subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    client.join(WORKERS_ROOM);
    return { ok: true, room: WORKERS_ROOM };
  }

  @SubscribeMessage('workers.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    client.leave(WORKERS_ROOM);
    return { ok: true };
  }

  @OnEvent(WorkerSeenEvent.INTERNAL)
  handleWorkerSeen(event: WorkerSeenEvent) {
    const dto = WorkerResponseDto.fromEntity(event.payload);
    const wireEvent: WorkerSeenWireEvent = {
      worker: dto,
      occurredAt: event.occurredAt.toISOString(),
    };

    this.server.to(WORKERS_ROOM).emit(WorkerWireEvents.WORKER_SEEN, wireEvent);
    this.logger.debug(
      `Emitted ${WorkerWireEvents.WORKER_SEEN} for worker ${dto.id}`,
    );
  }
}
