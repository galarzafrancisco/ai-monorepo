import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronExpressionParser } from 'cron-parser';
import { ScheduledTaskEntity } from './scheduled-task.entity';
import { TaskBlueprintEntity } from './task-blueprint.entity';
import { TaskBlueprintsService } from './task-blueprints.service';
import {
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
  ListScheduledTasksInput,
  ScheduledTaskResult,
  ListScheduledTasksResult,
} from './dto/service/scheduled-tasks.service.types';
import {
  ScheduledTaskNotFoundError,
  TaskBlueprintNotFoundError,
  InvalidCronExpressionError,
} from './errors/task-blueprints.errors';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    @InjectRepository(ScheduledTaskEntity)
    private readonly scheduledTaskRepository: Repository<ScheduledTaskEntity>,
    @InjectRepository(TaskBlueprintEntity)
    private readonly taskBlueprintRepository: Repository<TaskBlueprintEntity>,
    private readonly taskBlueprintsService: TaskBlueprintsService,
  ) {}

  async createScheduledTask(
    input: CreateScheduledTaskInput,
  ): Promise<ScheduledTaskResult> {
    this.logger.log({
      message: 'Creating scheduled task',
      taskBlueprintId: input.taskBlueprintId,
      cronExpression: input.cronExpression,
    });

    // Verify blueprint exists
    const blueprint = await this.taskBlueprintRepository.findOne({
      where: { id: input.taskBlueprintId },
    });

    if (!blueprint) {
      throw new TaskBlueprintNotFoundError(input.taskBlueprintId);
    }

    // Validate and calculate next run time
    const nextRunAt = this.calculateNextRun(input.cronExpression);

    const scheduledTask = this.scheduledTaskRepository.create({
      taskBlueprintId: input.taskBlueprintId,
      cronExpression: input.cronExpression,
      enabled: input.enabled ?? true,
      lastRunAt: null,
      nextRunAt,
    });

    const savedScheduledTask =
      await this.scheduledTaskRepository.save(scheduledTask);

    this.logger.log({
      message: 'Scheduled task created',
      scheduledTaskId: savedScheduledTask.id,
      nextRunAt: savedScheduledTask.nextRunAt,
    });

    // Reload with relations
    return this.getScheduledTaskById(savedScheduledTask.id);
  }

  async updateScheduledTask(
    scheduledTaskId: string,
    input: UpdateScheduledTaskInput,
  ): Promise<ScheduledTaskResult> {
    this.logger.log({
      message: 'Updating scheduled task',
      scheduledTaskId,
    });

    const scheduledTask = await this.scheduledTaskRepository.findOne({
      where: { id: scheduledTaskId },
    });

    if (!scheduledTask) {
      throw new ScheduledTaskNotFoundError(scheduledTaskId);
    }

    // Apply partial updates
    if (input.cronExpression !== undefined) {
      scheduledTask.cronExpression = input.cronExpression;
      // Recalculate next run time
      scheduledTask.nextRunAt = this.calculateNextRun(input.cronExpression);
    }

    if (input.enabled !== undefined) {
      scheduledTask.enabled = input.enabled;
    }

    await this.scheduledTaskRepository.save(scheduledTask);

    this.logger.log({
      message: 'Scheduled task updated',
      scheduledTaskId,
    });

    return this.getScheduledTaskById(scheduledTaskId);
  }

  async deleteScheduledTask(scheduledTaskId: string): Promise<void> {
    this.logger.log({
      message: 'Deleting scheduled task',
      scheduledTaskId,
    });

    const scheduledTask = await this.scheduledTaskRepository.findOne({
      where: { id: scheduledTaskId },
    });

    if (!scheduledTask) {
      throw new ScheduledTaskNotFoundError(scheduledTaskId);
    }

    await this.scheduledTaskRepository.softRemove(scheduledTask);

    this.logger.log({
      message: 'Scheduled task deleted',
      scheduledTaskId,
    });
  }

  async getScheduledTaskById(
    scheduledTaskId: string,
  ): Promise<ScheduledTaskResult> {
    const scheduledTask = await this.scheduledTaskRepository.findOne({
      where: { id: scheduledTaskId },
      relations: ['taskBlueprint', 'taskBlueprint.tags', 'taskBlueprint.assigneeActor', 'taskBlueprint.createdByActor'],
    });

    if (!scheduledTask) {
      throw new ScheduledTaskNotFoundError(scheduledTaskId);
    }

    return this.mapScheduledTaskToResult(scheduledTask);
  }

  async listScheduledTasks(
    input: ListScheduledTasksInput,
  ): Promise<ListScheduledTasksResult> {
    this.logger.log({
      message: 'Listing scheduled tasks',
      page: input.page,
      limit: input.limit,
      enabled: input.enabled,
    });

    const skip = (input.page - 1) * input.limit;

    const queryBuilder = this.scheduledTaskRepository
      .createQueryBuilder('scheduledTask')
      .leftJoinAndSelect('scheduledTask.taskBlueprint', 'taskBlueprint')
      .leftJoinAndSelect('taskBlueprint.tags', 'tags')
      .leftJoinAndSelect('taskBlueprint.assigneeActor', 'assigneeActor')
      .leftJoinAndSelect('taskBlueprint.createdByActor', 'createdByActor')
      .orderBy('scheduledTask.nextRunAt', 'ASC')
      .skip(skip)
      .take(input.limit);

    if (input.enabled !== undefined) {
      queryBuilder.andWhere('scheduledTask.enabled = :enabled', {
        enabled: input.enabled,
      });
    }

    const [scheduledTasks, total] = await queryBuilder.getManyAndCount();

    this.logger.log({
      message: 'Scheduled tasks listed',
      count: scheduledTasks.length,
      total,
      page: input.page,
    });

    return {
      items: scheduledTasks.map((scheduledTask) =>
        this.mapScheduledTaskToResult(scheduledTask),
      ),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  /**
   * Gets all enabled scheduled tasks that are due to run
   */
  async getDueScheduledTasks(): Promise<ScheduledTaskResult[]> {
    const now = new Date();

    const scheduledTasks = await this.scheduledTaskRepository.find({
      where: {
        enabled: true,
      },
      relations: ['taskBlueprint', 'taskBlueprint.tags', 'taskBlueprint.assigneeActor', 'taskBlueprint.createdByActor'],
    });

    // Filter tasks that are due (nextRunAt <= now)
    const dueTasks = scheduledTasks.filter(
      (task) => task.nextRunAt <= now,
    );

    return dueTasks.map((task) => this.mapScheduledTaskToResult(task));
  }

  /**
   * Marks a scheduled task as executed and calculates next run time
   */
  async markAsExecuted(scheduledTaskId: string): Promise<void> {
    this.logger.log({
      message: 'Marking scheduled task as executed',
      scheduledTaskId,
    });

    const scheduledTask = await this.scheduledTaskRepository.findOne({
      where: { id: scheduledTaskId },
    });

    if (!scheduledTask) {
      throw new ScheduledTaskNotFoundError(scheduledTaskId);
    }

    const now = new Date();
    scheduledTask.lastRunAt = now;
    scheduledTask.nextRunAt = this.calculateNextRun(
      scheduledTask.cronExpression,
      now,
    );

    await this.scheduledTaskRepository.save(scheduledTask);

    this.logger.log({
      message: 'Scheduled task marked as executed',
      scheduledTaskId,
      lastRunAt: scheduledTask.lastRunAt,
      nextRunAt: scheduledTask.nextRunAt,
    });
  }

  /**
   * Validates cron expression and calculates the next run time
   */
  private calculateNextRun(cronExpression: string, from?: Date): Date {
    try {
      const interval = CronExpressionParser.parse(cronExpression, {
        currentDate: from || new Date(),
      });
      return interval.next().toDate();
    } catch (error) {
      throw new InvalidCronExpressionError(
        cronExpression,
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  private mapScheduledTaskToResult(
    scheduledTask: ScheduledTaskEntity,
  ): ScheduledTaskResult {
    return {
      id: scheduledTask.id,
      taskBlueprintId: scheduledTask.taskBlueprintId,
      taskBlueprint: scheduledTask.taskBlueprint
        ? this.taskBlueprintsService.mapBlueprintToResult(scheduledTask.taskBlueprint)
        : undefined,
      cronExpression: scheduledTask.cronExpression,
      enabled: scheduledTask.enabled,
      lastRunAt: scheduledTask.lastRunAt,
      nextRunAt: scheduledTask.nextRunAt,
      rowVersion: scheduledTask.rowVersion,
      createdAt: scheduledTask.createdAt,
      updatedAt: scheduledTask.updatedAt,
      deletedAt: scheduledTask.deletedAt ?? null,
    };
  }
}
