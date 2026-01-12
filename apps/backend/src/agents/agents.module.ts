import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './agent.entity';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AdkModule } from '../adk/adk.module';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEntity]),
    AdkModule,
    AuthorizationServerModule,
    AuthModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
