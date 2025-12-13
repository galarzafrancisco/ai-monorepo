import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './agent.entity';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AdkModule } from '../adk/adk.module';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity]), AdkModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
