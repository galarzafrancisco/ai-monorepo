import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import {
  ExecutionWireEvents,
  type ExecutionsChangedWireEvent,
} from '@taico/events';
import { WsAccessTokenGuard } from '../auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from '../auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from '../tasks/tasks.scopes';
import { ActiveExecutionsChangedEvent } from './events/active-executions-changed.event';

const EXECUTIONS_ROOM = 'executions';

@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(TasksScopes.READ.id)
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/executions' })
export class ExecutionsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ExecutionsGateway.name);

  afterInit(): void {
    this.logger.log('Executions WebSocket Gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected to executions namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected from executions namespace: ${client.id}`);
  }

  @SubscribeMessage('executions.subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    client.join(EXECUTIONS_ROOM);
    return { ok: true, room: EXECUTIONS_ROOM };
  }

  @SubscribeMessage('executions.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    client.leave(EXECUTIONS_ROOM);
    return { ok: true };
  }

  @OnEvent(ActiveExecutionsChangedEvent.INTERNAL)
  handleActiveExecutionsChanged(event: ActiveExecutionsChangedEvent): void {
    const wireEvent: ExecutionsChangedWireEvent = {
      occurredAt: event.occurredAt.toISOString(),
    };
    this.server.to(EXECUTIONS_ROOM).emit(ExecutionWireEvents.EXECUTIONS_CHANGED, wireEvent);
  }
}
