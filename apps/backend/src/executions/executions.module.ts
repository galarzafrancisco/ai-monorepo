import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskExecutionEntity } from './task-execution.entity';
import { WorkerSessionEntity } from './worker-session.entity';
import { ExecutionContextResolverService } from './execution-context-resolver.service';
import { ExecutionReconcilerService } from './execution-reconciler.service';
import { ExecutionClaimService } from './execution-claim.service';
import { ExecutionsService } from './executions.service';
import { WorkerSessionService } from './worker-session.service';
import { ExecutionsController } from './executions.controller';
import { WorkersGateway } from './workers.gateway';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { ThreadsModule } from '../threads/threads.module';
import { TaskEntity } from '../tasks/task.entity';
import { InputRequestEntity } from '../tasks/input-request.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { AgentEntity } from '../agents/agent.entity';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';

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
    AuthGuardsModule,
  ],
  controllers: [ExecutionsController],
  providers: [
    ExecutionContextResolverService,
    ExecutionReconcilerService,
    ExecutionClaimService,
    ExecutionsService,
    WorkerSessionService,
    WorkersGateway,
  ],
  exports: [
    ExecutionContextResolverService,
    ExecutionClaimService,
    WorkersGateway,
  ],
})
export class ExecutionsModule {}
