import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

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

  emitTaskCreated(task: any) {
    this.server.emit('task.created', task);
  }

  emitTaskUpdated(task: any) {
    this.server.emit('task.updated', task);
  }

  emitTaskDeleted(taskId: string) {
    this.server.emit('task.deleted', { taskId });
  }

  emitTaskAssigned(task: any) {
    this.server.emit('task.assigned', task);
  }

  emitCommentAdded(comment: any) {
    this.server.emit('task.commented', comment);
  }

  emitStatusChanged(task: any) {
    this.server.emit('task.status_changed', task);
  }
}
