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
  BlockCreatedEvent,
  BlockUpdatedEvent,
  BlockDeletedEvent,
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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
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

  @OnEvent('block.created')
  handlePageCreated(event: BlockCreatedEvent) {
    this.server.to(CONTEXT_ROOM).emit('block.created', event.block);
  }

  @OnEvent('block.updated')
  handlePageUpdated(event: BlockUpdatedEvent) {
    this.server.to(CONTEXT_ROOM).emit('block.updated', event.block);
  }

  @OnEvent('block.deleted')
  handlePageDeleted(event: BlockDeletedEvent) {
    this.server
      .to(CONTEXT_ROOM)
      .emit('block.deleted', { blockId: event.blockId });
  }
}
