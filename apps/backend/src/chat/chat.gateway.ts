import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import {
  SessionCreatedEvent,
  SessionUpdatedEvent,
  SessionDeletedEvent,
  TaskReferencedEvent,
  TaskSubscribedEvent,
  TaskUnsubscribedEvent,
} from './events/chat.events';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to chat gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from chat gateway: ${client.id}`);
  }

  /**
   * Broadcasts session created event to all connected clients
   */
  @OnEvent('session.created')
  async handleSessionCreated(event: SessionCreatedEvent) {
    this.logger.log(`Broadcasting session.created: ${event.session.id}`);
    const sessionResult = await this.chatService.getSessionById(
      event.session.id,
    );
    this.server.emit('session.created', sessionResult);
  }

  /**
   * Broadcasts session updated event to all connected clients
   */
  @OnEvent('session.updated')
  async handleSessionUpdated(event: SessionUpdatedEvent) {
    this.logger.log(`Broadcasting session.updated: ${event.session.id}`);
    const sessionResult = await this.chatService.getSessionById(
      event.session.id,
    );
    this.server.emit('session.updated', sessionResult);
  }

  /**
   * Broadcasts session deleted event to all connected clients
   */
  @OnEvent('session.deleted')
  handleSessionDeleted(event: SessionDeletedEvent) {
    this.logger.log(`Broadcasting session.deleted: ${event.sessionId}`);
    this.server.emit('session.deleted', { sessionId: event.sessionId });
  }

  /**
   * Broadcasts task referenced event to all connected clients
   */
  @OnEvent('task.referenced')
  handleTaskReferenced(event: TaskReferencedEvent) {
    this.logger.log(
      `Broadcasting task.referenced: session=${event.sessionId}, task=${event.taskId}`,
    );
    this.server.emit('task.referenced', {
      sessionId: event.sessionId,
      taskId: event.taskId,
    });
  }

  /**
   * Broadcasts task subscribed event to all connected clients
   */
  @OnEvent('task.subscribed')
  handleTaskSubscribed(event: TaskSubscribedEvent) {
    this.logger.log(
      `Broadcasting task.subscribed: session=${event.sessionId}, task=${event.taskId}`,
    );
    this.server.emit('task.subscribed', {
      sessionId: event.sessionId,
      taskId: event.taskId,
    });
  }

  /**
   * Broadcasts task unsubscribed event to all connected clients
   */
  @OnEvent('task.unsubscribed')
  handleTaskUnsubscribed(event: TaskUnsubscribedEvent) {
    this.logger.log(
      `Broadcasting task.unsubscribed: session=${event.sessionId}, task=${event.taskId}`,
    );
    this.server.emit('task.unsubscribed', {
      sessionId: event.sessionId,
      taskId: event.taskId,
    });
  }
}
