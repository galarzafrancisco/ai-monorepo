import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PullRequestUpdatedWireEvent, PullRequestWireEvents } from '@taico/events';
import { WsScopesGuard } from 'src/auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { WsAccessTokenGuard } from 'src/auth/guards/guards/ws-access-token-guard';
import { PullRequestsScopes } from './pull-requests.scopes';
import { PullRequestUpdatedEvent } from './events/pull-requests.events';
import { toPullRequestResponse } from './dto/http/pull-request.mapper';

const PULL_REQUESTS_ROOM = 'pull-requests';

/**
 * Tells open pages when Taico's copy of a pull request changes. One room for
 * everything: updates are small and rare, and any page may show any pull
 * request. Pages load the state through REST first (POST /pull-requests/lookup).
 */
@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(PullRequestsScopes.READ.id)
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/pull-requests',
})
export class PullRequestsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('pull_requests.subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    void client.join(PULL_REQUESTS_ROOM);
    return { ok: true, room: PULL_REQUESTS_ROOM };
  }

  @SubscribeMessage('pull_requests.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    void client.leave(PULL_REQUESTS_ROOM);
    return { ok: true };
  }

  @OnEvent(PullRequestUpdatedEvent.INTERNAL)
  handleUpdated(event: PullRequestUpdatedEvent) {
    const wire: PullRequestUpdatedWireEvent = {
      pullRequest: toPullRequestResponse(event.pullRequest),
      changes: event.changes,
      occurredAt: event.occurredAt.toISOString(),
    };
    this.server.to(PULL_REQUESTS_ROOM).emit(PullRequestWireEvents.PULL_REQUEST_UPDATED, wire);
  }
}
