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
 * Listens to domain events and broadcasts them via WebSocket.
 * This decouples the service layer from transport concerns.
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

  @OnEvent('task.created')
  handleTaskCreated(event: TaskCreatedEvent) {
    this.server.to(TASKS_ROOM).emit('task.created', event.payload, event.actor);
  }

  @OnEvent('task.updated')
  handleTaskUpdated(event: TaskUpdatedEvent) {
    this.server.to(TASKS_ROOM).emit('task.updated', event.payload, event.actor);
  }

  @OnEvent('task.deleted')
  handleTaskDeleted(event: TaskDeletedEvent) {
    this.server.to(TASKS_ROOM).emit('task.deleted', { taskId: event.taskId }, event.actor);
  }

  @OnEvent('task.assigned')
  handleTaskAssigned(event: TaskAssignedEvent) {
    this.server.to(TASKS_ROOM).emit('task.assigned', event.payload, event.actor);
  }

  @OnEvent('comment.added')
  handleCommentAdded(event: CommentAddedEvent) {
    this.server.to(TASKS_ROOM).emit('task.commented', event.payload, event.actor);
  }

  @OnEvent('task.statusChanged')
  handleStatusChanged(event: TaskStatusChangedEvent) {
    this.server.to(TASKS_ROOM).emit('task.status_changed', event.payload, event.actor);
  }

  @OnEvent('input_request.answered')
  handleInputRequestAnswered(event: InputRequestAnsweredEvent) {
    this.server.to(TASKS_ROOM).emit('input.request.answered', event.payload, event.actor);
  }


  // Listen to incoming messages
  @SubscribeMessage('task.activity.post')
  postTaskActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: TaskActivityPayload,
  ) {

    // ultra-MVP "validation"
    if (!body?.taskId) return { ok: false, error: 'taskId required' };

    const event = {
      taskId: body.taskId,
      kind: body.kind ?? 'worker.activity',
      message: body.message,
      ts: body.ts ?? Date.now(),
      by: client.id, // optional: useful for debugging
    };

    this.logger.log(event);

    // broadcast to everyone (including the sender)
    this.server.to(TASKS_ROOM).emit('task.activity', event);

    return { ok: true };
  }
}
