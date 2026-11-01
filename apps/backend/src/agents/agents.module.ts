import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './agent.entity';
import { AgentToolPermissionEntity } from './agent-tool-permission.entity';
import { AgentToolPermissionScopeEntity } from './agent-tool-permission-scope.entity';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentDefinitionsController } from './agent-definitions.controller';
import { AgentTokensController } from './agent-tokens.controller';
import { AgentExecutionTokensController } from './agent-execution-tokens.controller';
import { AgentToolPermissionsController } from './agent-tool-permissions.controller';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';
import { McpServerEntity } from '../mcp-registry/entities/mcp-server.entity';
import { AgentToolPermissionsService } from './agent-tool-permissions.service';
import { AgentImportExportService } from './agent-import-export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      AgentToolPermissionEntity,
      AgentToolPermissionScopeEntity,
      McpServerEntity,
    ]),
    AuthorizationServerModule,
    AuthGuardsModule,
    IdentityProviderModule,
  ],
  controllers: [
    AgentsController,
    AgentDefinitionsController,
    AgentToolPermissionsController,
    AgentTokensController,
    AgentExecutionTokensController,
  ],
  providers: [AgentsService, AgentToolPermissionsService, AgentImportExportService],
  exports: [AgentsService],
})
export class AgentsModule {}
