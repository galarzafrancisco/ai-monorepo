import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { WorkspaceMemberRemovedEvent } from './workspace-member-removed.event';
import { workspaceMemberRoom } from './workspace-rooms';

/**
 * Disconnects a removed member's sockets for that workspace, in every
 * namespace and on every backend. It handles no messages; it only needs the
 * socket server.
 */
@WebSocketGateway()
export class WorkspaceMemberSocketsGateway {
  private readonly logger = new Logger(WorkspaceMemberSocketsGateway.name);

  @WebSocketServer()
  server!: Server;

  @OnEvent(WorkspaceMemberRemovedEvent.INTERNAL)
  disconnectRemovedMember(event: WorkspaceMemberRemovedEvent): void {
    const room = workspaceMemberRoom(event.workspaceId, event.actorId);
    // `_nsps` holds every namespace registered on this server; the adapter
    // carries each disconnect to the other backends.
    const namespaces = (this.server as unknown as { _nsps: Map<string, unknown> })._nsps;
    for (const name of namespaces.keys()) {
      this.server.of(name).in(room).disconnectSockets(true);
    }
    this.logger.log(`Disconnected sockets of removed member ${event.actorId} in ${event.workspaceId}`);
  }
}
