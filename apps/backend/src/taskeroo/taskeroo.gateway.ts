import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { TaskEntity } from './task.entity';
import { CommentEntity } from './comment.entity';

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

  emitTaskCreated(task: TaskEntity) {
    this.server.emit('task.created', task);
  }

  emitTaskUpdated(task: TaskEntity) {
    this.server.emit('task.updated', task);
  }

  emitTaskDeleted(taskId: string) {
    this.server.emit('task.deleted', { taskId });
  }

  emitTaskAssigned(task: TaskEntity) {
    this.server.emit('task.assigned', task);
  }

  emitCommentAdded(comment: CommentEntity) {
    this.server.emit('task.commented', comment);
  }

  emitStatusChanged(task: TaskEntity) {
    this.server.emit('task.status_changed', task);
  }
}
