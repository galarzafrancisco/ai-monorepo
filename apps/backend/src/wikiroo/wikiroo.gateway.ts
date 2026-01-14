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
} from './events/wikiroo.events';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { WikirooScopes } from './wikiroo.scopes';


const WIKIROO_ROOM = 'wikiroo';


/**
 * WebSocket gateway for Wikiroo domain.
 * Listens to domain events and broadcasts them via WebSocket.
 * This decouples the service layer from transport concerns.
 */
@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(WikirooScopes.READ.id)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/wikiroo',
})
export class WikirooGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(WikirooGateway.name);

  afterInit() {
    this.logger.log('Wikiroo WebSocket Gateway initialized');
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

  @SubscribeMessage('wikiroo.subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    client.join(WIKIROO_ROOM);
    return { ok: true, room: WIKIROO_ROOM };
  }

  @SubscribeMessage('wikiroo.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    client.leave(WIKIROO_ROOM);
    return { ok: true };
  }

  @OnEvent('page.created')
  handlePageCreated(event: PageCreatedEvent) {
    this.server.to(WIKIROO_ROOM).emit('page.created', event.page);
  }

  @OnEvent('page.updated')
  handlePageUpdated(event: PageUpdatedEvent) {
    this.server.to(WIKIROO_ROOM).emit('page.updated', event.page);
  }

  @OnEvent('page.deleted')
  handlePageDeleted(event: PageDeletedEvent) {
    this.server.to(WIKIROO_ROOM).emit('page.deleted', { pageId: event.pageId });
  }
}
