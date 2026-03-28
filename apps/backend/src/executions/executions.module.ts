import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskExecutionEntity } from './task-execution.entity';
import { WorkerSessionEntity } from './worker-session.entity';
import { ExecutionContextResolverService } from './execution-context-resolver.service';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { ThreadsModule } from '../threads/threads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskExecutionEntity,
      WorkerSessionEntity,
      AgentRunEntity,
    ]),
    forwardRef(() => ThreadsModule),
  ],
  providers: [ExecutionContextResolverService],
  exports: [ExecutionContextResolverService],
})
export class ExecutionsModule {}
