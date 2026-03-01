import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BlockCreatedEvent,
  BlockUpdatedEvent,
  BlockDeletedEvent,
} from './events/context.events';
import { BlockResponseDto } from './dto/block-response.dto';
import { ContextWireEvents } from './api/context.wire-events';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { ContextScopes } from './context.scopes';
import { ContextService } from './context.service';

const CONTEXT_ROOM = 'context';
const getBlockRoomName = (blockId: string): string => `${CONTEXT_ROOM}-${blockId}`;

type ContextSubscriptionPayload = {
  blockId?: string;
};

/**
 * WebSocket gateway for Context domain.
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
  constructor(private readonly contextService: ContextService) {}

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
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ContextSubscriptionPayload,
  ) {
    if (!body?.blockId) {
      client.join(CONTEXT_ROOM);
      return { ok: true, room: CONTEXT_ROOM };
    }

    try {
      await this.contextService.getBlockById(body.blockId);
    } catch {
      return { ok: false, error: 'block not found' };
    }

    const room = getBlockRoomName(body.blockId);
    client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('context.unsubscribe')
  unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ContextSubscriptionPayload,
  ) {
    if (!body?.blockId) {
      client.leave(CONTEXT_ROOM);
      return { ok: true };
    }

    client.leave(getBlockRoomName(body.blockId));
    return { ok: true };
  }

  /**
   * Domain event handlers
   * These listen to internal Symbol-based events and map them to wire events.
   */

  @OnEvent(BlockCreatedEvent.INTERNAL)
  handleBlockCreated(event: BlockCreatedEvent) {
    const dto = BlockResponseDto.fromEntity(event.block);

    this.server.to(CONTEXT_ROOM).emit(ContextWireEvents.CONTEXT_BLOCK_CREATED, {
      payload: dto,
      actor: event.actor,
    });

    this.logger.debug({
      message: 'Block created event emitted',
      blockId: event.block.id,
      actorId: event.actor.id,
    });
  }

  @OnEvent(BlockUpdatedEvent.INTERNAL)
  handleBlockUpdated(event: BlockUpdatedEvent) {
    const dto = BlockResponseDto.fromEntity(event.block);

    this.server.to(CONTEXT_ROOM).emit(ContextWireEvents.CONTEXT_BLOCK_UPDATED, {
      payload: dto,
      actor: event.actor,
    });

    this.server
      .to(getBlockRoomName(event.block.id))
      .emit(ContextWireEvents.CONTEXT_BLOCK_UPDATED, {
        payload: dto,
        actor: event.actor,
      });

    this.logger.debug({
      message: 'Block updated event emitted',
      blockId: event.block.id,
      actorId: event.actor.id,
    });
  }

  @OnEvent(BlockDeletedEvent.INTERNAL)
  handleBlockDeleted(event: BlockDeletedEvent) {
    this.server.to(CONTEXT_ROOM).emit(ContextWireEvents.CONTEXT_BLOCK_DELETED, {
      payload: { blockId: event.blockId },
      actor: event.actor,
    });

    this.server
      .to(getBlockRoomName(event.blockId))
      .emit(ContextWireEvents.CONTEXT_BLOCK_DELETED, {
        payload: { blockId: event.blockId },
        actor: event.actor,
      });

    this.logger.debug({
      message: 'Block deleted event emitted',
      blockId: event.blockId,
      actorId: event.actor.id,
    });
  }
}
