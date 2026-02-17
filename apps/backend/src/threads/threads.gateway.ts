import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MessageCreatedEvent } from './events/threads.events';
import { ThreadWireEvents } from '@taico/events';
import { Actor, MessageCreatedWireEvent } from '@taico/events';
import { ThreadMessageResponseDto } from './dto/thread-message-response.dto';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { ThreadsScopes } from './threads.scopes';

const THREADS_ROOM = 'threads';

/**
 * WebSocket gateway for Threads domain.
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
@RequireScopes(ThreadsScopes.READ.id)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/threads',
})
export class ThreadsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(ThreadsGateway.name);

  afterInit() {
    this.logger.log('Threads WebSocket Gateway initialized');
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

  @SubscribeMessage('threads.subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    client.join(THREADS_ROOM);
    return { ok: true, room: THREADS_ROOM };
  }

  @SubscribeMessage('threads.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    client.leave(THREADS_ROOM);
    return { ok: true };
  }

  /**
   * Domain event handlers
   * These listen to internal Symbol-based events and map them to wire events.
   */

  @OnEvent(MessageCreatedEvent.INTERNAL)
  handleMessageCreated(event: MessageCreatedEvent) {
    const dto = ThreadMessageResponseDto.fromEntity(event.payload);

    const wireEvent: MessageCreatedWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server.to(THREADS_ROOM).emit(ThreadWireEvents.MESSAGE_CREATED, wireEvent);

    this.logger.debug({
      message: 'Message created event emitted',
      messageId: event.payload.id,
      threadId: event.payload.threadId,
      actorId: event.actor.id,
    });
  }
}
