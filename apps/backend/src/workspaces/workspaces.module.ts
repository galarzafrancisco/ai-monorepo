import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceEntity } from './workspace.entity';
import { WorkspaceMemberEntity } from './workspace-member.entity';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceMembershipSubscriber } from './workspace-membership.subscriber';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceEntity, WorkspaceMemberEntity])],
  providers: [WorkspacesService, WorkspaceMembershipSubscriber],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
