import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IssueUpdatedWireEvent, IssueWireEvents } from '@taico/events';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { IssuesScopes } from './issues.scopes';
import { IssueUpdatedEvent } from './events/issues.events';
import { toIssueResponse } from './dto/http/issue.mapper';
import { WorkspaceAccess } from '../auth/guards/decorators/workspace-access.decorator';
import { socketWorkspaceId, workspaceRoom } from '../workspaces/workspace-rooms';

const ISSUES_ROOM = 'issues';

/**
 * Tells open pages when Taico's copy of an issue changes. One room per
 * workspace: updates are small and rare, and any page may show any of the
 * workspace's issues.
 * Pages load the state through REST first (POST /issues/lookup).
 */
@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(IssuesScopes.READ.id)
@WorkspaceAccess('scoped')
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/issues',
})
export class IssuesGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('issues.subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    void client.join(workspaceRoom(socketWorkspaceId(client), ISSUES_ROOM));
    return { ok: true, room: ISSUES_ROOM };
  }

  @SubscribeMessage('issues.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    void client.leave(workspaceRoom(socketWorkspaceId(client), ISSUES_ROOM));
    return { ok: true };
  }

  @OnEvent(IssueUpdatedEvent.INTERNAL)
  handleUpdated(event: IssueUpdatedEvent) {
    const wire: IssueUpdatedWireEvent = {
      issue: toIssueResponse(event.issue),
      changes: event.changes,
      occurredAt: event.occurredAt.toISOString(),
    };
    this.server.to(workspaceRoom(event.issue.workspaceId, ISSUES_ROOM)).emit(IssueWireEvents.ISSUE_UPDATED, wire);
  }
}
