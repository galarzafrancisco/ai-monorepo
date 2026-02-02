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
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskAssignedEvent,
  TaskDeletedEvent,
  CommentAddedEvent,
  TaskStatusChangedEvent,
  InputRequestAnsweredEvent,
} from './events/tasks.events';
import { TaskWireEvents } from "@taico/events";
import type {
  TaskCreatedWireEvent,
  TaskUpdatedWireEvent,
  TaskDeletedWireEvent,
  TaskAssignedWireEvent,
  TaskStatusChangedWireEvent,
  TaskCommentedWireEvent,
  InputRequestAnsweredWireEvent,
  TaskActivityWireEvent,
} from '@taico/events';
import { TaskResponseDto } from './dto/task-response.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { InputRequestResponseDto } from './dto/input-request-response.dto';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from './tasks.scopes';

const TASKS_ROOM = 'tasks';

type TaskActivityPayload = {
  taskId: string;
  kind?: string;
  message: string;
  ts: number;
};

/**
 * WebSocket gateway for Tasks domain.
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
  namespace: '/tasks',
})
export class TasksGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(TasksGateway.name);

  afterInit() {
    this.logger.log('Tasks WebSocket Gateway initialized');
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

  @SubscribeMessage('tasks.subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    client.join(TASKS_ROOM);
    return { ok: true, room: TASKS_ROOM };
  }

  @SubscribeMessage('tasks.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    client.leave(TASKS_ROOM);
    return { ok: true };
  }

  // TODO: implement (Tasks.snapshot) to send current state of tasks to the client

  /**
   * Domain event handlers
   * These listen to internal Symbol-based events and map them to wire events.
   */

  @OnEvent(TaskCreatedEvent.INTERNAL)
  handleTaskCreated(event: TaskCreatedEvent) {
    const dto = TaskResponseDto.fromEntity(event.payload);

    const wireEvent: TaskCreatedWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server.to(TASKS_ROOM).emit(TaskWireEvents.TASK_CREATED, wireEvent);

    this.logger.debug({
      message: 'Task created event emitted',
      taskId: event.payload.id,
      actorId: event.actor.id,
    });
  }

  @OnEvent(TaskUpdatedEvent.INTERNAL)
  handleTaskUpdated(event: TaskUpdatedEvent) {
    const dto = TaskResponseDto.fromEntity(event.payload);

    const wireEvent: TaskUpdatedWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server.to(TASKS_ROOM).emit(TaskWireEvents.TASK_UPDATED, wireEvent);

    this.logger.debug({
      message: 'Task updated event emitted',
      taskId: event.payload.id,
      actorId: event.actor.id,
    });
  }

  @OnEvent(TaskDeletedEvent.INTERNAL)
  handleTaskDeleted(event: TaskDeletedEvent) {
    const wireEvent: TaskDeletedWireEvent = {
      payload: { taskId: event.taskId },
      actor: { id: event.actor.id },
    };

    this.server.to(TASKS_ROOM).emit(TaskWireEvents.TASK_DELETED, wireEvent);

    this.logger.debug({
      message: 'Task deleted event emitted',
      taskId: event.taskId,
      actorId: event.actor.id,
    });
  }

  @OnEvent(TaskAssignedEvent.INTERNAL)
  handleTaskAssigned(event: TaskAssignedEvent) {
    const dto = TaskResponseDto.fromEntity(event.payload);

    const wireEvent: TaskAssignedWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server.to(TASKS_ROOM).emit(TaskWireEvents.TASK_ASSIGNED, wireEvent);

    this.logger.debug({
      message: 'Task assigned event emitted',
      taskId: event.payload.id,
      actorId: event.actor.id,
    });
  }

  @OnEvent(CommentAddedEvent.INTERNAL)
  handleCommentAdded(event: CommentAddedEvent) {
    const dto = CommentResponseDto.fromEntity(event.payload);

    const wireEvent: TaskCommentedWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server.to(TASKS_ROOM).emit(TaskWireEvents.TASK_COMMENTED, wireEvent);

    this.logger.debug({
      message: 'Comment added event emitted',
      commentId: event.payload.id,
      taskId: event.payload.taskId,
      actorId: event.actor.id,
    });
  }

  @OnEvent(TaskStatusChangedEvent.INTERNAL)
  handleStatusChanged(event: TaskStatusChangedEvent) {
    const dto = TaskResponseDto.fromEntity(event.payload);

    const wireEvent: TaskStatusChangedWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server
      .to(TASKS_ROOM)
      .emit(TaskWireEvents.TASK_STATUS_CHANGED, wireEvent);

    this.logger.debug({
      message: 'Task status changed event emitted',
      taskId: event.payload.id,
      status: event.payload.status,
      actorId: event.actor.id,
    });
  }

  @OnEvent(InputRequestAnsweredEvent.INTERNAL)
  handleInputRequestAnswered(event: InputRequestAnsweredEvent) {
    const dto = InputRequestResponseDto.fromEntity(event.payload);

    const wireEvent: InputRequestAnsweredWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server
      .to(TASKS_ROOM)
      .emit(TaskWireEvents.INPUT_REQUEST_ANSWERED, wireEvent);

    this.logger.debug({
      message: 'Input request answered event emitted',
      inputRequestId: event.payload.id,
      taskId: event.payload.taskId,
      actorId: event.actor.id,
    });
  }

  // Listen to incoming messages
  @SubscribeMessage(TaskWireEvents.TASK_ACTIVITY_POST)
  postTaskActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: TaskActivityPayload,
  ) {
    // ultra-MVP "validation"
    if (!body?.taskId) return { ok: false, error: 'taskId required' };

    const wireEvent: TaskActivityWireEvent = {
      taskId: body.taskId,
      kind: body.kind ?? 'worker.activity',
      message: body.message,
      ts: body.ts ?? Date.now(),
      by: client.id, // optional: useful for debugging
    };

    this.logger.log(wireEvent);

    // broadcast to everyone (including the sender)
    this.server.to(TASKS_ROOM).emit(TaskWireEvents.TASK_ACTIVITY, wireEvent);

    return { ok: true };
  }
}
