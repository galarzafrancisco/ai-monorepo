import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { TaskEntity } from '../tasks/task.entity';
import { ActiveTaskExecutionEntity } from './active/active-task-execution.entity';
import { ActiveTaskExecutionController } from './active/active-task-execution.controller';
import { ActiveTaskExecutionService } from './active/active-task-execution.service';
import { ActiveExecutionContextResolverService } from './active/active-execution-context-resolver.service';
import { TaskExecutionHistoryController } from './history/task-execution-history.controller';
import { TaskExecutionHistoryEntity } from './history/task-execution-history.entity';
import { TaskExecutionHistoryService } from './history/task-execution-history.service';
import { TaskEligibilityEventSourceService } from './readiness/task-eligibility-event-source.service';
import { TaskExecutionQueueEntity } from './queue/task-execution-queue.entity';
import { TaskExecutionQueueController } from './queue/task-execution-queue.controller';
import { TaskExecutionQueueService } from './queue/task-execution-queue.service';
import { ReadinessCandidateRepository } from './readiness/readiness-candidate.repository';
import { TaskEligibilitySchedulerService } from './readiness/task-eligibility-scheduler.service';
import { TaskExecutionQueuePopulatorService } from './readiness/task-execution-queue-populator.service';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { ThreadsModule } from '../threads/threads.module';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { ExecutionActivityService } from './execution-activity.service';
import { TaskActivityProjectionService } from './task-activity-projection.service';
import { ExecutionsV2WorkerGateway } from './executions-v2-worker.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      TaskExecutionQueueEntity,
      ActiveTaskExecutionEntity,
      TaskExecutionHistoryEntity,
      AgentRunEntity,
    ]),
    AgentsModule,
    ThreadsModule,
    AuthGuardsModule,
  ],
  controllers: [
    TaskExecutionQueueController,
    ActiveTaskExecutionController,
    TaskExecutionHistoryController,
  ],
  providers: [
    TaskExecutionQueueService,
    ActiveTaskExecutionService,
    ActiveExecutionContextResolverService,
    TaskExecutionHistoryService,
    ExecutionActivityService,
    TaskActivityProjectionService,
    ExecutionsV2WorkerGateway,
    ReadinessCandidateRepository,
    TaskExecutionQueuePopulatorService,
    TaskEligibilityEventSourceService,
    TaskEligibilitySchedulerService,
  ],
  exports: [ActiveExecutionContextResolverService],
})
export class ExecutionsV2Module {}
