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
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskAssignedEvent,
  TaskDeletedEvent,
  CommentAddedEvent,
  TaskStatusChangedEvent,
} from './events/tasks.events';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from './tasks.scopes';


const Tasks_ROOM = 'Tasks';


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
    client.join(Tasks_ROOM);
    return { ok: true, room: Tasks_ROOM };
  }

  @SubscribeMessage('tasks.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    client.leave(Tasks_ROOM);
    return { ok: true };
  }

  // TODO: implement (Tasks.snapshot) to send current state of tasks to the client

  @OnEvent('task.created')
  onTaskCreated(event: TaskCreatedEvent) {
    this.server.to(Tasks_ROOM).emit('task.created', event.task);
  }
  @OnEvent('task.created')
  handleTaskCreated(event: TaskCreatedEvent) {
    this.server.to(Tasks_ROOM).emit('task.created', event.task);
  }

  @OnEvent('task.updated')
  handleTaskUpdated(event: TaskUpdatedEvent) {
    this.server.to(Tasks_ROOM).emit('task.updated', event.task);
  }

  @OnEvent('task.deleted')
  handleTaskDeleted(event: TaskDeletedEvent) {
    this.server.to(Tasks_ROOM).emit('task.deleted', { taskId: event.taskId });
  }

  @OnEvent('task.assigned')
  handleTaskAssigned(event: TaskAssignedEvent) {
    this.server.to(Tasks_ROOM).emit('task.assigned', event.task);
  }

  @OnEvent('comment.added')
  handleCommentAdded(event: CommentAddedEvent) {
    this.server.to(Tasks_ROOM).emit('task.commented', event.comment);
  }

  @OnEvent('task.statusChanged')
  handleStatusChanged(event: TaskStatusChangedEvent) {
    this.server.to(Tasks_ROOM).emit('task.status_changed', event.task);
  }
}
