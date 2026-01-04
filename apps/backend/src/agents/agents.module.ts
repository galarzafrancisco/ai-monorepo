import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './agent.entity';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AdkModule } from '../adk/adk.module';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEntity]),
    AdkModule,
    AuthorizationServerModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
