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
  ThreadAgentResponseDeltaEvent,
  ThreadPinnedEvent,
  ThreadReadEvent,
  ThreadTitleUpdatedEvent,
  ThreadUpdatedEvent,
} from './events/threads.events';
import { ThreadWireEvents } from '@taico/events';
import {
  AgentActivityWireEvent,
  AgentResponseDeltaWireEvent,
  MessageCreatedWireEvent,
  ThreadActivityWireEvent,
  ThreadPinnedWireEvent,
  ThreadReadWireEvent,
  ThreadUpdatedWireEvent,
  ThreadTitleUpdatedWireEvent,
} from '@taico/events';
import { ThreadMessageResponseDto } from './dto/thread-message-response.dto';
import { ThreadResponseDto } from './dto/thread-response.dto';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { ThreadsScopes } from './threads.scopes';
import { ThreadsService } from './threads.service';
import type { AuthContext } from 'src/auth/guards/context/auth-context.types';
import { socketWorkspaceId, workspaceRoom } from '../workspaces/workspace-rooms';
import { WorkspaceAccess } from '../auth/guards/decorators/workspace-access.decorator';

const THREADS_ROOM = 'threads';

/**
 * The thread list room carries every thread's activity and title, so it is
 * per workspace. A per-thread room is keyed by the thread id alone: a socket
 * only joins it after the thread was found in the socket's workspace, and a
 * thread is in exactly one workspace.
 */
const getThreadListRoomName = (workspaceId: string): string =>
  workspaceRoom(workspaceId, THREADS_ROOM);

type ThreadSubscriptionPayload = {
  threadId?: string;
};

const getThreadRoomName = (threadId: string): string => `${THREADS_ROOM}-${threadId}`;
const getThreadActorRoomName = (threadId: string, actorId: string): string =>
  `${THREADS_ROOM}-${threadId}-actor-${actorId}`;

/**
 * Every list socket of one actor in one workspace: all their tabs and
 * devices. A person can be in several workspaces, so it is per workspace.
 */
const getActorRoomName = (workspaceId: string, actorId: string): string =>
  workspaceRoom(workspaceId, `${THREADS_ROOM}-actor-${actorId}`);

const getActorId = (client: Socket): string | undefined =>
  (client.data?.auth as AuthContext | undefined)?.claims.actor_id;

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
@WorkspaceAccess('scoped')
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
      const listRoom = getThreadListRoomName(socketWorkspaceId(client));
      client.join(listRoom);
      const actorId = getActorId(client);
      if (actorId) {
        client.join(getActorRoomName(socketWorkspaceId(client), actorId));
      }
      return { ok: true, room: listRoom };
    }

    try {
      await this.threadsService.assertThreadInWorkspace(
        socketWorkspaceId(client),
        body.threadId,
      );
    } catch {
      return { ok: false, error: 'thread not found' };
    }

    const room = getThreadRoomName(body.threadId);
    client.join(room);
    const actorId = getActorId(client);
    if (actorId) {
      client.join(getThreadActorRoomName(body.threadId, actorId));
    }
    return { ok: true, room };
  }

  @SubscribeMessage('threads.unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ThreadSubscriptionPayload,
  ) {
    if (!body?.threadId) {
      client.leave(getThreadListRoomName(socketWorkspaceId(client)));
      const actorId = getActorId(client);
      if (actorId) {
        client.leave(getActorRoomName(socketWorkspaceId(client), actorId));
      }
      return { ok: true };
    }

    const room = getThreadRoomName(body.threadId);
    client.leave(room);
    const actorId = getActorId(client);
    if (actorId) {
      client.leave(getThreadActorRoomName(body.threadId, actorId));
    }
    return { ok: true };
  }

  /**
   * Domain event handlers
   * These listen to internal Symbol-based events and map them to wire events.
   */

  @OnEvent(MessageCreatedEvent.INTERNAL)
  async handleMessageCreated(event: MessageCreatedEvent) {
    const dto = ThreadMessageResponseDto.fromEntity(event.payload);

    const wireEvent: MessageCreatedWireEvent = {
      payload: dto,
      actor: { id: event.actor.id },
    };

    this.server
      .to(getThreadRoomName(event.payload.threadId))
      .emit(ThreadWireEvents.MESSAGE_CREATED, wireEvent);

    // The list only needs to know that something was posted, not the message.
    const activityEvent: ThreadActivityWireEvent = {
      payload: {
        threadId: event.payload.threadId,
        messageId: event.payload.id,
        createdByActorId: event.payload.createdByActorId,
        createdAt: event.payload.createdAt.toISOString(),
      },
      actor: { id: event.actor.id },
    };
    await this.emitToThreadList(
      event.payload.threadId,
      ThreadWireEvents.THREAD_ACTIVITY,
      activityEvent,
    );

    this.logger.debug({
      message: 'Message created event emitted',
      messageId: event.payload.id,
      threadId: event.payload.threadId,
      actorId: event.actor.id,
    });
  }

  @OnEvent(ThreadReadEvent.INTERNAL)
  async handleThreadRead(event: ThreadReadEvent) {
    if (!this.server) {
      return;
    }

    const wireEvent: ThreadReadWireEvent = {
      payload: { threadId: event.payload.threadId },
      actor: { id: event.actor.id },
    };

    await this.emitToActorList(
      event.payload.threadId,
      event.payload.actorId,
      ThreadWireEvents.THREAD_READ,
      wireEvent,
    );
  }

  @OnEvent(ThreadPinnedEvent.INTERNAL)
  async handleThreadPinned(event: ThreadPinnedEvent) {
    if (!this.server) {
      return;
    }

    const wireEvent: ThreadPinnedWireEvent = {
      payload: {
        threadId: event.payload.threadId,
        pinned: event.payload.pinned,
      },
      actor: { id: event.actor.id },
    };

    await this.emitToActorList(
      event.payload.threadId,
      event.payload.actorId,
      ThreadWireEvents.THREAD_PINNED,
      wireEvent,
    );
  }

  @OnEvent(ThreadAgentActivityEvent.INTERNAL)
  handleAgentActivity(event: ThreadAgentActivityEvent) {
    if (!this.server) {
      return;
    }

    const room = getThreadRoomName(event.payload.threadId);

    const { detailActorId, input, output, ...metadata } = event.payload;
    const wireEvent: AgentActivityWireEvent = {
      payload: {
        ...metadata,
        occurredAt: event.occurredAt.toISOString(),
      },
      actor: { id: event.actor.id },
    };

    // A thread subscription alone does not grant access to a tool's underlying
    // tasks/context. Only the actor whose delegated token ran the tool receives
    // its arguments and result; all other viewers see the lifecycle metadata.
    if (detailActorId && (input !== undefined || output !== undefined)) {
      const detailRoom = getThreadActorRoomName(event.payload.threadId, detailActorId);
      this.server.to(detailRoom).emit(ThreadWireEvents.AGENT_ACTIVITY, {
        ...wireEvent,
        payload: { ...wireEvent.payload, input, output },
      } satisfies AgentActivityWireEvent);
      this.server.to(room).except(detailRoom).emit(ThreadWireEvents.AGENT_ACTIVITY, wireEvent);
      return;
    }
    this.server.to(room).emit(ThreadWireEvents.AGENT_ACTIVITY, wireEvent);
  }

  @OnEvent(ThreadAgentResponseDeltaEvent.INTERNAL)
  handleAgentResponseDelta(event: ThreadAgentResponseDeltaEvent) {
    if (!this.server) {
      return;
    }

    const room = getThreadRoomName(event.payload.threadId);

    const wireEvent: AgentResponseDeltaWireEvent = {
      payload: {
        threadId: event.payload.threadId,
        streamId: event.payload.streamId,
        delta: event.payload.delta,
      },
      actor: { id: event.actor.id },
    };

    this.server
      .to(room)
      .emit(ThreadWireEvents.AGENT_RESPONSE_DELTA, wireEvent);
  }

  @OnEvent(ThreadTitleUpdatedEvent.INTERNAL)
  async handleThreadTitleUpdated(event: ThreadTitleUpdatedEvent) {
    if (!this.server) {
      return;
    }

    const wireEvent: ThreadTitleUpdatedWireEvent = {
      payload: {
        threadId: event.payload.threadId,
        title: event.payload.title,
      },
      actor: { id: event.actor.id },
    };

    this.server
      .to(getThreadRoomName(event.payload.threadId))
      .emit(ThreadWireEvents.THREAD_TITLE_UPDATED, wireEvent);

    await this.emitToThreadList(
      event.payload.threadId,
      ThreadWireEvents.THREAD_TITLE_UPDATED,
      wireEvent,
    );
  }

  /** Emits to the list room of the thread's own workspace. */
  private async emitToThreadList(
    threadId: string,
    eventName: string,
    wireEvent: unknown,
  ): Promise<void> {
    const workspaceId = await this.threadsService.getThreadWorkspaceId(threadId);
    if (!workspaceId) {
      return;
    }
    this.server.to(getThreadListRoomName(workspaceId)).emit(eventName, wireEvent);
  }

  /** Emits to one actor's list sockets in the thread's own workspace. */
  private async emitToActorList(
    threadId: string,
    actorId: string,
    eventName: string,
    wireEvent: unknown,
  ): Promise<void> {
    const workspaceId = await this.threadsService.getThreadWorkspaceId(threadId);
    if (!workspaceId) {
      return;
    }
    this.server.to(getActorRoomName(workspaceId, actorId)).emit(eventName, wireEvent);
  }

  @OnEvent(ThreadUpdatedEvent.INTERNAL)
  async handleThreadUpdated(event: ThreadUpdatedEvent) {
    if (!this.server) {
      return;
    }

    try {
      const thread = await this.threadsService.getThreadById(event.payload.id);
      const wireEvent: ThreadUpdatedWireEvent = {
        payload: ThreadResponseDto.fromResult(thread),
        actor: { id: event.actor.id },
      };

      this.server
        .to(getThreadRoomName(thread.id))
        .emit(ThreadWireEvents.THREAD_UPDATED, wireEvent);
    } catch (error) {
      this.logger.warn({
        message: 'Failed to emit thread.updated event',
        threadId: event.payload.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
