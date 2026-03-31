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
import {
  ExecutionCreatedEvent,
  ExecutionUpdatedEvent,
  ExecutionDeletedEvent,
} from './events/executions.events';
import { ExecutionWireEvents } from '@taico/events';
import type {
  ExecutionCreatedWireEvent,
  ExecutionUpdatedWireEvent,
  ExecutionDeletedWireEvent,
} from '@taico/events';
import { ExecutionResponseDto } from './dto/http/execution-response.dto';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from '../tasks/tasks.scopes';

const EXECUTIONS_ROOM = 'executions';

/**
 * WebSocket gateway for Executions domain.
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
@RequireScopes(TasksScopes.READ.id)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/executions',
})
export class ExecutionsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(ExecutionsGateway.name);

  afterInit() {
    this.logger.log('Executions WebSocket Gateway initialized');
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

  /**
   * Domain event handlers
   * These listen to internal Symbol-based events and map them to wire events.
   */

  @OnEvent(ExecutionCreatedEvent.INTERNAL)
  handleExecutionCreated(event: ExecutionCreatedEvent) {
    const dto = this.entityToDto(event.payload);

    const wireEvent: ExecutionCreatedWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server
      .to(EXECUTIONS_ROOM)
      .emit(ExecutionWireEvents.EXECUTION_CREATED, wireEvent);

    this.logger.debug({
      message: 'Execution created event emitted',
      executionId: event.payload.id,
      actorId: event.actor.id,
    });
  }

  @OnEvent(ExecutionUpdatedEvent.INTERNAL)
  handleExecutionUpdated(event: ExecutionUpdatedEvent) {
    const dto = this.entityToDto(event.payload);

    const wireEvent: ExecutionUpdatedWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server
      .to(EXECUTIONS_ROOM)
      .emit(ExecutionWireEvents.EXECUTION_UPDATED, wireEvent);

    this.logger.debug({
      message: 'Execution updated event emitted',
      executionId: event.payload.id,
      actorId: event.actor.id,
    });
  }

  @OnEvent(ExecutionDeletedEvent.INTERNAL)
  handleExecutionDeleted(event: ExecutionDeletedEvent) {
    const wireEvent: ExecutionDeletedWireEvent = {
      payload: { executionId: event.executionId },
      actor: { id: event.actor.id },
    };

    this.server
      .to(EXECUTIONS_ROOM)
      .emit(ExecutionWireEvents.EXECUTION_DELETED, wireEvent);

    this.logger.debug({
      message: 'Execution deleted event emitted',
      executionId: event.executionId,
      actorId: event.actor.id,
    });
  }

  /**
   * Helper method to convert entity to DTO
   * This is similar to ExecutionResponseDto.fromResult but works with entities
   */
  private entityToDto(entity: any): any {
    return {
      id: entity.id,
      taskId: entity.taskId,
      taskName: entity.task?.name ?? null,
      agentActorId: entity.agentActorId,
      agentSlug: entity.agentActor?.slug ?? null,
      agentName: entity.agentActor?.displayName ?? null,
      status: entity.status,
      requestedAt: entity.requestedAt.toISOString(),
      claimedAt: entity.claimedAt ? entity.claimedAt.toISOString() : null,
      startedAt: entity.startedAt ? entity.startedAt.toISOString() : null,
      finishedAt: entity.finishedAt ? entity.finishedAt.toISOString() : null,
      workerSessionId: entity.workerSessionId,
      leaseExpiresAt: entity.leaseExpiresAt
        ? entity.leaseExpiresAt.toISOString()
        : null,
      stopRequestedAt: entity.stopRequestedAt
        ? entity.stopRequestedAt.toISOString()
        : null,
      failureReason: entity.failureReason,
      triggerReason: entity.triggerReason,
      rowVersion: entity.rowVersion,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
