import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PageCreatedEvent,
  PageUpdatedEvent,
  PageDeletedEvent,
} from './events/wikiroo.events';

/**
 * WebSocket gateway for Wikiroo domain.
 * Listens to domain events and broadcasts them via WebSocket.
 * This decouples the service layer from transport concerns.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/wikiroo',
})
export class WikirooGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(WikirooGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @OnEvent('page.created')
  handlePageCreated(event: PageCreatedEvent) {
    this.server.emit('page.created', event.page);
  }

  @OnEvent('page.updated')
  handlePageUpdated(event: PageUpdatedEvent) {
    this.server.emit('page.updated', event.page);
  }

  @OnEvent('page.deleted')
  handlePageDeleted(event: PageDeletedEvent) {
    this.server.emit('page.deleted', { pageId: event.pageId });
  }
}
