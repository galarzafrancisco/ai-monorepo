import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './agent.entity';
import { AgentToolPermissionEntity } from './agent-tool-permission.entity';
import { AgentToolPermissionScopeEntity } from './agent-tool-permission-scope.entity';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentTokensController } from './agent-tokens.controller';
import { AgentExecutionTokensController } from './agent-execution-tokens.controller';
import { AgentToolPermissionsController } from './agent-tool-permissions.controller';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';
import { McpServerEntity } from '../mcp-registry/entities/mcp-server.entity';
import { AgentToolPermissionsService } from './agent-tool-permissions.service';

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
    AgentToolPermissionsController,
    AgentTokensController,
    AgentExecutionTokensController,
  ],
  providers: [AgentsService, AgentToolPermissionsService],
  exports: [AgentsService],
})
export class AgentsModule {}
