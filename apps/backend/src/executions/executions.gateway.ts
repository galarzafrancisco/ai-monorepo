import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import {
  ExecutionWireEvents,
  type ExecutionsChangedWireEvent,
} from '@taico/events';
import { WsAccessTokenGuard } from '../auth/guards/guards/ws-access-token-guard';
import { WsScopesGuard } from '../auth/guards/guards/ws-scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from '../tasks/tasks.scopes';
import { ActiveExecutionsChangedEvent } from './events/active-executions-changed.event';

import { isUUID } from 'class-validator';
import { ExecutionTracesChangedEvent } from './events/execution-traces-changed.event';
import { WorkspaceAccess } from '../auth/guards/decorators/workspace-access.decorator';
import { socketWorkspaceId, workspaceRoom } from '../workspaces/workspace-rooms';

const EXECUTIONS_ROOM = 'executions';
const tracesRoom = (executionId: string) => `execution-traces-${executionId}`;

/** Every room is in the socket's workspace, and events go to the execution's. */
@UseGuards(WsAccessTokenGuard, WsScopesGuard)
@RequireScopes(TasksScopes.READ.id)
@WorkspaceAccess('scoped')
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/executions' })
export class ExecutionsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ExecutionsGateway.name);

  afterInit(): void {
    this.logger.log('Executions WebSocket Gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected to executions namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected from executions namespace: ${client.id}`);
  }

  @SubscribeMessage('executions.subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    client.join(workspaceRoom(socketWorkspaceId(client), EXECUTIONS_ROOM));
    return { ok: true, room: EXECUTIONS_ROOM };
  }

  @SubscribeMessage('executions.unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket) {
    client.leave(workspaceRoom(socketWorkspaceId(client), EXECUTIONS_ROOM));
    return { ok: true };
  }

  @SubscribeMessage('execution.traces.subscribe')
  subscribeTraces(@ConnectedSocket() client: Socket, @MessageBody() body: { executionId?: string }) {
    if (typeof body?.executionId !== 'string' || !isUUID(body.executionId)) return { ok: false };
    client.join(workspaceRoom(socketWorkspaceId(client), tracesRoom(body.executionId)));
    return { ok: true };
  }

  @SubscribeMessage('execution.traces.unsubscribe')
  unsubscribeTraces(@ConnectedSocket() client: Socket, @MessageBody() body: { executionId?: string }) {
    if (typeof body?.executionId !== 'string' || !isUUID(body.executionId)) return { ok: false };
    client.leave(workspaceRoom(socketWorkspaceId(client), tracesRoom(body.executionId)));
    return { ok: true };
  }

  @OnEvent(ExecutionTracesChangedEvent.INTERNAL)
  handleTracesChanged(event: ExecutionTracesChangedEvent): void {
    this.server.to(workspaceRoom(event.workspaceId, tracesRoom(event.executionId))).emit(
      ExecutionWireEvents.EXECUTION_TRACES_CHANGED, { executionId: event.executionId });
  }

  @OnEvent(ActiveExecutionsChangedEvent.INTERNAL)
  handleActiveExecutionsChanged(event: ActiveExecutionsChangedEvent): void {
    const wireEvent: ExecutionsChangedWireEvent = {
      occurredAt: event.occurredAt.toISOString(),
    };
    this.server
      .to(workspaceRoom(event.workspaceId, EXECUTIONS_ROOM))
      .emit(ExecutionWireEvents.EXECUTIONS_CHANGED, wireEvent);
  }
}
