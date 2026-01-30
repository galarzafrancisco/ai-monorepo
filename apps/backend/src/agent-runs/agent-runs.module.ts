import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentRunEntity } from './agent-run.entity';
import { AgentRunsService } from './agent-runs.service';
import { AgentRunsController } from './agent-runs.controller';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';

@Module({
  imports: [TypeOrmModule.forFeature([AgentRunEntity]), AuthGuardsModule],
  controllers: [AgentRunsController],
  providers: [AgentRunsService],
  exports: [AgentRunsService],
})
export class AgentRunsModule {}
