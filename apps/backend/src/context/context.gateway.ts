import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PageCreatedEvent,
  PageUpdatedEvent,
  PageDeletedEvent,
} from './events/context.events';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { ContextScopes } from './context.scopes';


const CONTEXT_ROOM = 'context';


/**
 * WebSocket gateway for Context domain.
 * Listens to domain events and broadcasts them via WebSocket.
 * This decouples the service layer from transport concerns.
 */
@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(ContextScopes.READ.id)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/context',
})
export class ContextGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(ContextGateway.name);

  afterInit() {
    this.logger.log('Context WebSocket Gateway initialized');
  }
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /*
     * Room implementation
     */

  @SubscribeMessage('context.subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    client.join(CONTEXT_ROOM);
    return { ok: true, room: CONTEXT_ROOM };
  }

  @SubscribeMessage('context.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    client.leave(CONTEXT_ROOM);
    return { ok: true };
  }

  @OnEvent('page.created')
  handlePageCreated(event: PageCreatedEvent) {
    this.server.to(CONTEXT_ROOM).emit('page.created', event.page);
  }

  @OnEvent('page.updated')
  handlePageUpdated(event: PageUpdatedEvent) {
    this.server.to(CONTEXT_ROOM).emit('page.updated', event.page);
  }

  @OnEvent('page.deleted')
  handlePageDeleted(event: PageDeletedEvent) {
    this.server.to(CONTEXT_ROOM).emit('page.deleted', { pageId: event.pageId });
  }
}
