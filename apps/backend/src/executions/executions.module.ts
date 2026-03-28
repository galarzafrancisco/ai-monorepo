import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskExecutionEntity } from './task-execution.entity';
import { WorkerSessionEntity } from './worker-session.entity';
import { ExecutionContextResolverService } from './execution-context-resolver.service';
import { ExecutionReconcilerService } from './execution-reconciler.service';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { ThreadsModule } from '../threads/threads.module';
import { TaskEntity } from '../tasks/task.entity';
import { InputRequestEntity } from '../tasks/input-request.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { AgentEntity } from '../agents/agent.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskExecutionEntity,
      WorkerSessionEntity,
      AgentRunEntity,
      TaskEntity,
      InputRequestEntity,
      ActorEntity,
      AgentEntity,
    ]),
    forwardRef(() => ThreadsModule),
  ],
  providers: [ExecutionContextResolverService, ExecutionReconcilerService],
  exports: [ExecutionContextResolverService],
})
export class ExecutionsModule {}
