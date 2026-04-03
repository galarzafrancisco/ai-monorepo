import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveTaskExecutionEntity } from './active/active-task-execution.entity';
import { ActiveTaskExecutionController } from './active/active-task-execution.controller';
import { ActiveTaskExecutionService } from './active/active-task-execution.service';
import { TaskExecutionHistoryController } from './history/task-execution-history.controller';
import { TaskExecutionHistoryEntity } from './history/task-execution-history.entity';
import { TaskExecutionHistoryService } from './history/task-execution-history.service';
import { TaskEligibilityEventSourceService } from './readiness/task-eligibility-event-source.service';
import { TaskExecutionQueueEntity } from './queue/task-execution-queue.entity';
import { TaskExecutionQueueController } from './queue/task-execution-queue.controller';
import { TaskExecutionQueueService } from './queue/task-execution-queue.service';
import { TaskEligibilityReconcilerService } from './readiness/task-eligibility-reconciler.service';
import { TaskEligibilitySchedulerService } from './readiness/task-eligibility-scheduler.service';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskExecutionQueueEntity,
      ActiveTaskExecutionEntity,
      TaskExecutionHistoryEntity,
    ]),
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
    TaskExecutionHistoryService,
    TaskEligibilityReconcilerService,
    TaskEligibilityEventSourceService,
    TaskEligibilitySchedulerService,
  ],
})
export class ExecutionsV2Module {}
