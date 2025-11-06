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
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskAssignedEvent,
  TaskDeletedEvent,
  CommentAddedEvent,
  TaskStatusChangedEvent,
} from './events/taskeroo.events';

/**
 * WebSocket gateway for Taskeroo domain.
 * Listens to domain events and broadcasts them via WebSocket.
 * This decouples the service layer from transport concerns.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/taskeroo',
})
export class TaskerooGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(TaskerooGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @OnEvent('task.created')
  handleTaskCreated(event: TaskCreatedEvent) {
    this.server.emit('task.created', event.task);
  }

  @OnEvent('task.updated')
  handleTaskUpdated(event: TaskUpdatedEvent) {
    this.server.emit('task.updated', event.task);
  }

  @OnEvent('task.deleted')
  handleTaskDeleted(event: TaskDeletedEvent) {
    this.server.emit('task.deleted', { taskId: event.taskId });
  }

  @OnEvent('task.assigned')
  handleTaskAssigned(event: TaskAssignedEvent) {
    this.server.emit('task.assigned', event.task);
  }

  @OnEvent('comment.added')
  handleCommentAdded(event: CommentAddedEvent) {
    this.server.emit('task.commented', event.comment);
  }

  @OnEvent('task.statusChanged')
  handleStatusChanged(event: TaskStatusChangedEvent) {
    this.server.emit('task.status_changed', event.task);
  }
}
