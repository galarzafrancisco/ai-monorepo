import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayInit,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  MessageCreatedEvent,
  ThreadAgentActivityEvent,
} from './events/threads.events';
import { ThreadWireEvents } from '@taico/events';
import { AgentActivityWireEvent, MessageCreatedWireEvent } from '@taico/events';
import { ThreadMessageResponseDto } from './dto/thread-message-response.dto';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { ThreadsScopes } from './threads.scopes';
import { ThreadsService } from './threads.service';

const THREADS_ROOM = 'threads';

type ThreadSubscriptionPayload = {
  threadId?: string;
};

const getThreadRoomName = (threadId: string): string => `${THREADS_ROOM}-${threadId}`;

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
  constructor(private readonly threadsService: ThreadsService) {}

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
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ThreadSubscriptionPayload,
  ) {
    if (!body?.threadId) {
      client.join(THREADS_ROOM);
      return { ok: true, room: THREADS_ROOM };
    }

    try {
      await this.threadsService.getThreadById(body.threadId);
    } catch {
      return { ok: false, error: 'thread not found' };
    }

    const room = getThreadRoomName(body.threadId);
    client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('threads.unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ThreadSubscriptionPayload,
  ) {
    if (!body?.threadId) {
      client.leave(THREADS_ROOM);
      return { ok: true };
    }

    const room = getThreadRoomName(body.threadId);
    client.leave(room);
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

    this.server
      .to(getThreadRoomName(event.payload.threadId))
      .emit(ThreadWireEvents.MESSAGE_CREATED, wireEvent);

    this.logger.debug({
      message: 'Message created event emitted',
      messageId: event.payload.id,
      threadId: event.payload.threadId,
      actorId: event.actor.id,
    });
  }

  @OnEvent(ThreadAgentActivityEvent.INTERNAL)
  handleAgentActivity(event: ThreadAgentActivityEvent) {
    if (!this.server) {
      return;
    }

    const room = getThreadRoomName(event.payload.threadId);

    const wireEvent: AgentActivityWireEvent = {
      payload: {
        threadId: event.payload.threadId,
        kind: event.payload.kind,
      },
      actor: { id: event.actor.id },
    };

    this.server
      .to(room)
      .emit(ThreadWireEvents.AGENT_ACTIVITY, wireEvent);
  }
}
