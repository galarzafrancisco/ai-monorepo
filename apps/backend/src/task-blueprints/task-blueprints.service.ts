import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, In } from 'typeorm';
import { TaskBlueprintEntity } from './task-blueprint.entity';
import { ScheduledTaskEntity } from './scheduled-task.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { MetaService } from '../meta/meta.service';
import { ActorService } from '../identity-provider/actor.service';
import { TasksService } from '../tasks/tasks.service';
import {
  CreateTaskBlueprintInput,
  UpdateTaskBlueprintInput,
  ListTaskBlueprintsInput,
  TaskBlueprintResult,
  ListTaskBlueprintsResult,
} from './dto/service/task-blueprints.service.types';
import {
  TaskBlueprintNotFoundError,
  TaskBlueprintHasActiveSchedulesError,
} from './errors/task-blueprints.errors';
import { TagEntity } from '../meta/tag.entity';
import {
  ActorResult,
  TagResult,
  TaskResult,
} from '../tasks/dto/service/tasks.service.types';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { ActorNotFoundError } from '../tasks/errors/tasks.errors';

@Injectable()
export class TaskBlueprintsService {
  private readonly logger = new Logger(TaskBlueprintsService.name);

  constructor(
    @InjectRepository(TaskBlueprintEntity)
    private readonly taskBlueprintRepository: Repository<TaskBlueprintEntity>,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
    @InjectRepository(ScheduledTaskEntity)
    private readonly scheduledTaskRepository: Repository<ScheduledTaskEntity>,
    private readonly metaService: MetaService,
    private readonly actorService: ActorService,
    private readonly tasksService: TasksService,
    private readonly workspacesService: WorkspacesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTaskBlueprint(
    workspaceId: string,
    input: CreateTaskBlueprintInput,
  ): Promise<TaskBlueprintResult> {
    this.logger.log({
      message: 'Creating task blueprint',
      name: input.name,
    });

    // Look up actor IDs from slugs
    let assigneeActorId: string | null = null;

    if (input.assigneeActorId) {
      const assigneeActor = await this.findAssignableActor(
        workspaceId,
        input.assigneeActorId,
      );
      if (!assigneeActor) {
        throw new ActorNotFoundError(input.assigneeActorId);
      }
      assigneeActorId = assigneeActor.id;
    }

    // createdBy is required
    const createdByActor = await this.actorService.getActorByIdOrSlug(
      workspaceId,
      input.createdByActorId,
    );
    if (!createdByActor) {
      throw new Error(`Creator actor not found: ${input.createdByActorId}`);
    }
    const createdByActorId = createdByActor.id;

    const blueprint = this.taskBlueprintRepository.create({
      workspaceId,
      name: input.name,
      description: input.description,
      assigneeActorId,
      createdByActorId,
    });

    // Handle dependsOnIds: only tasks of this workspace, checked now so a
    // blueprint never stores an id it can't create a task from.
    if (input.dependsOnIds && input.dependsOnIds.length > 0) {
      await this.tasksService.assertTasksInWorkspace(workspaceId, input.dependsOnIds);
      blueprint.dependsOnIds = input.dependsOnIds;
    }

    const savedBlueprint = await this.taskBlueprintRepository.save(blueprint);

    // Handle tags if provided
    if (input.tagNames && input.tagNames.length > 0) {
      const tags = await this.metaService.findOrCreateTagEntities(
        workspaceId,
        input.tagNames,
      );
      savedBlueprint.tags = tags;
      await this.taskBlueprintRepository.save(savedBlueprint);
    }

    // Reload with relations
    const blueprintWithRelations = await this.taskBlueprintRepository.findOne({
      where: { workspaceId, id: savedBlueprint.id },
      relations: ['tags', 'assigneeActor', 'createdByActor'],
    });

    if (!blueprintWithRelations) {
      throw new TaskBlueprintNotFoundError(savedBlueprint.id);
    }

    this.logger.log({
      message: 'Task blueprint created',
      blueprintId: blueprintWithRelations.id,
      name: blueprintWithRelations.name,
    });

    return this.mapBlueprintToResult(blueprintWithRelations);
  }

  async updateTaskBlueprint(
    workspaceId: string,
    blueprintId: string,
    input: UpdateTaskBlueprintInput,
  ): Promise<TaskBlueprintResult> {
    this.logger.log({
      message: 'Updating task blueprint',
      blueprintId,
    });

    const blueprint = await this.taskBlueprintRepository.findOne({
      where: { workspaceId, id: blueprintId },
      relations: ['tags', 'assigneeActor', 'createdByActor'],
    });

    if (!blueprint) {
      throw new TaskBlueprintNotFoundError(blueprintId);
    }

    // Apply partial updates
    if (input.name !== undefined) blueprint.name = input.name;
    if (input.description !== undefined)
      blueprint.description = input.description;

    // Look up actor IDs from slugs for assignee
    if (input.assigneeActorId !== undefined) {
      if (input.assigneeActorId === null) {
        blueprint.assigneeActorId = null;
      } else {
        const assigneeActor = await this.findAssignableActor(
          workspaceId,
          input.assigneeActorId,
        );
        if (!assigneeActor) {
          throw new ActorNotFoundError(input.assigneeActorId);
        }
        blueprint.assigneeActorId = assigneeActor.id;
        blueprint.assigneeActor = assigneeActor;
      }
    }

    // Handle tags if provided
    if (input.tagNames !== undefined) {
      if (input.tagNames.length === 0) {
        blueprint.tags = [];
      } else {
        blueprint.tags = await this.metaService.findOrCreateTagEntities(
          workspaceId,
          input.tagNames,
        );
      }
    }

    // Handle dependencies if provided (only tasks of this workspace)
    if (input.dependsOnIds !== undefined) {
      await this.tasksService.assertTasksInWorkspace(workspaceId, input.dependsOnIds);
      blueprint.dependsOnIds = input.dependsOnIds;
    }

    const updatedBlueprint = await this.taskBlueprintRepository.save(blueprint);

    // Reload with relations to ensure we have updated tags
    const blueprintWithRelations = await this.taskBlueprintRepository.findOne({
      where: { workspaceId, id: blueprintId },
      relations: ['tags', 'assigneeActor', 'createdByActor'],
    });

    if (!blueprintWithRelations) {
      throw new TaskBlueprintNotFoundError(blueprintId);
    }

    this.logger.log({
      message: 'Task blueprint updated',
      blueprintId: blueprintWithRelations.id,
    });

    return this.mapBlueprintToResult(blueprintWithRelations);
  }

  async deleteTaskBlueprint(
    workspaceId: string,
    blueprintId: string,
  ): Promise<void> {
    this.logger.log({
      message: 'Deleting task blueprint',
      blueprintId,
    });

    const blueprint = await this.taskBlueprintRepository.findOne({
      where: { workspaceId, id: blueprintId },
    });

    if (!blueprint) {
      throw new TaskBlueprintNotFoundError(blueprintId);
    }

    const activeSchedules = await this.scheduledTaskRepository.count({
      where: {
        workspaceId,
        taskBlueprintId: blueprintId,
        enabled: true,
      },
    });

    if (activeSchedules > 0) {
      throw new TaskBlueprintHasActiveSchedulesError(blueprintId);
    }

    await this.taskBlueprintRepository.softRemove(blueprint);

    this.logger.log({
      message: 'Task blueprint deleted',
      blueprintId,
    });
  }

  async getTaskBlueprintById(
    workspaceId: string,
    blueprintId: string,
  ): Promise<TaskBlueprintResult> {
    const blueprint = await this.taskBlueprintRepository.findOne({
      where: { workspaceId, id: blueprintId },
      relations: ['tags', 'assigneeActor', 'createdByActor'],
    });

    if (!blueprint) {
      throw new TaskBlueprintNotFoundError(blueprintId);
    }

    return this.mapBlueprintToResult(blueprint);
  }

  async listTaskBlueprints(
    workspaceId: string,
    input: ListTaskBlueprintsInput,
  ): Promise<ListTaskBlueprintsResult> {
    this.logger.log({
      message: 'Listing task blueprints',
      page: input.page,
      limit: input.limit,
    });

    const skip = (input.page - 1) * input.limit;

    const queryBuilder = this.taskBlueprintRepository
      .createQueryBuilder('blueprint')
      .leftJoinAndSelect('blueprint.tags', 'tags')
      .leftJoinAndSelect('blueprint.assigneeActor', 'assigneeActor')
      .leftJoinAndSelect('blueprint.createdByActor', 'createdByActor')
      .where('blueprint.workspaceId = :workspaceId', { workspaceId })
      .orderBy('blueprint.updatedAt', 'DESC')
      .skip(skip)
      .take(input.limit);

    const [blueprints, total] = await queryBuilder.getManyAndCount();

    this.logger.log({
      message: 'Task blueprints listed',
      count: blueprints.length,
      total,
      page: input.page,
    });

    return {
      items: blueprints.map((blueprint) =>
        this.mapBlueprintToResult(blueprint),
      ),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  /**
   * Creates a regular task from a blueprint of the given workspace. Tags are
   * found or created by name there, and the assignee and dependencies must be
   * in that workspace (TasksService checks both before the first write).
   */
  async createTaskFromBlueprint(
    workspaceId: string,
    blueprintId: string,
  ): Promise<TaskResult> {
    this.logger.log({
      message: 'Creating task from blueprint',
      blueprintId,
    });

    const blueprint = await this.getTaskBlueprintById(workspaceId, blueprintId);

    const task = await this.tasksService.createTask(workspaceId, {
      name: blueprint.name,
      description: blueprint.description,
      assigneeActorId: blueprint.assigneeActorId ?? undefined,
      tagNames: blueprint.tags.map((tag) => tag.name),
      dependsOnIds: blueprint.dependsOnIds,
      createdByActorId: blueprint.createdByActor.id,
    });

    this.logger.log({
      message: 'Task created from blueprint',
      blueprintId,
      taskId: task.id,
    });

    return task;
  }

  /**
   * Maps a TaskBlueprintEntity to TaskBlueprintResult.
   * Public to allow reuse by ScheduledTasksService.
   */
  mapBlueprintToResult(blueprint: TaskBlueprintEntity): TaskBlueprintResult {
    if (!blueprint.createdByActor) {
      throw new Error(
        `Blueprint ${blueprint.id} is missing createdByActor relation`,
      );
    }

    return {
      id: blueprint.id,
      name: blueprint.name,
      description: blueprint.description,
      assigneeActorId: blueprint.assigneeActorId,
      assigneeActor: blueprint.assigneeActor
        ? this.mapActorToResult(blueprint.assigneeActor)
        : null,
      tags: (blueprint.tags || []).map((t) => this.mapTagToResult(t)),
      dependsOnIds: blueprint.dependsOnIds,
      createdByActor: this.mapActorToResult(blueprint.createdByActor),
      rowVersion: blueprint.rowVersion,
      createdAt: blueprint.createdAt,
      updatedAt: blueprint.updatedAt,
      deletedAt: blueprint.deletedAt ?? null,
    };
  }

  private async findAssignableActor(
    workspaceId: string,
    idOrSlug: string,
  ): Promise<ActorEntity | null> {
    const actor = await this.actorService.getActiveActorByIdOrSlug(
      workspaceId,
      idOrSlug,
    );
    if (!actor) return null;
    return (await this.workspacesService.isMember(workspaceId, actor.id))
      ? actor
      : null;
  }

  private mapActorToResult(actor: ActorEntity): ActorResult {
    return {
      id: actor.id,
      type: actor.type,
      slug: actor.slug,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
      introduction: actor.introduction,
      deletedAt: actor.deletedAt ?? null,
    };
  }

  private mapTagToResult(tag: TagEntity): TagResult {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }
}
