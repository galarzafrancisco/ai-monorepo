import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskBlueprintEntity } from './task-blueprint.entity';
import { ScheduledTaskEntity } from './scheduled-task.entity';
import { TaskBlueprintsService } from './task-blueprints.service';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { TaskSchedulerService } from './task-scheduler.service';
import { TaskBlueprintsController } from './task-blueprints.controller';
import { ScheduledTasksController } from './scheduled-tasks.controller';
import { TasksModule } from '../tasks/tasks.module';
import { MetaModule } from '../meta/meta.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskBlueprintEntity, ScheduledTaskEntity]),
    ScheduleModule.forRoot(),
    TasksModule,
    MetaModule,
    IdentityProviderModule,
    AuthGuardsModule,
  ],
  controllers: [TaskBlueprintsController, ScheduledTasksController],
  providers: [
    TaskBlueprintsService,
    ScheduledTasksService,
    TaskSchedulerService,
  ],
  exports: [TaskBlueprintsService, ScheduledTasksService],
})
export class TaskBlueprintsModule {}
