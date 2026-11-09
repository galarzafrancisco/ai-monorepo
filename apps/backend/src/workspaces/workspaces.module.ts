import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceEntity } from './workspace.entity';
import { WorkspaceMemberEntity } from './workspace-member.entity';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceMembershipGate } from './workspace-membership.gate';
import { WorkspaceMemberSocketsGateway } from './workspace-member-sockets.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceEntity, WorkspaceMemberEntity])],
  providers: [WorkspacesService, WorkspaceMembershipGate, WorkspaceMemberSocketsGateway],
  exports: [WorkspacesService, WorkspaceMembershipGate],
})
export class WorkspacesModule {}
