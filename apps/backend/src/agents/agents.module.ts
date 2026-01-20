import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './agent.entity';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentTokensController } from './agent-tokens.controller';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEntity]),
    AuthorizationServerModule,
    AuthGuardsModule,
    IdentityProviderModule,
  ],
  controllers: [AgentsController, AgentTokensController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
