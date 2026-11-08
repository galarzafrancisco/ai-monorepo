import { Module } from '@nestjs/common';
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
    WorkspacesModule,
    IdentityProviderModule,
    MetaModule,
    AgentsModule,
    AiProvidersModule,
    AuthGuardsModule,
  ],
  controllers: [WorkspaceAdminController],
  providers: [WorkspaceAdminService],
  exports: [WorkspaceAdminService],
})
export class WorkspaceAdminModule {}
