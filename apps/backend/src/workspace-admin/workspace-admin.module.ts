import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceInvitationEntity } from '../workspaces/workspace-invitation.entity';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { AgentsModule } from '../agents/agents.module';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';
import { MetaModule } from '../meta/meta.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WorkspaceAdminController } from './workspace-admin.controller';
import { WorkspaceAdminService } from './workspace-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceInvitationEntity]),
    WorkspacesModule,
    IdentityProviderModule,
    MetaModule,
    AgentsModule,
    AiProvidersModule,
    AuthGuardsModule,
  ],
  controllers: [WorkspaceAdminController],
  providers: [WorkspaceAdminService, WorkspaceInvitationsService],
  exports: [WorkspaceAdminService, WorkspaceInvitationsService],
})
export class WorkspaceAdminModule {}
