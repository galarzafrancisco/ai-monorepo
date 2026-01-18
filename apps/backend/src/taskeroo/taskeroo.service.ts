import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, In } from 'typeorm';
import { TaskEntity } from './task.entity';
import { TagEntity } from './tag.entity';
import { TaskStatus } from './enums';
import { CommentEntity } from './comment.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import {
  CreateTaskInput,
  UpdateTaskInput,
  AssignTaskInput,
  ChangeStatusInput,
  CreateCommentInput,
  ListTasksInput,
  AddTagInput,
  CreateTagInput,
  TaskResult,
  CommentResult,
  ListTasksResult,
  TagResult,
  ActorResult,
} from './dto/service/taskeroo.service.types';
import {
  TaskNotFoundError,
  InvalidStatusTransitionError,
  CommentRequiredError,
} from './errors/taskeroo.errors';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskAssignedEvent,
  TaskDeletedEvent,
  CommentAddedEvent,
  TaskStatusChangedEvent,
} from './events/taskeroo.events';
import { getRandomTagColor } from '../common/utils/color-palette.util';
import { ActorService } from 'src/identity-provider/actor.service';

@Injectable()
export class TaskerooService {
  private readonly logger = new Logger(TaskerooService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentRepository: Repository<CommentEntity>,
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
    private readonly actorService: ActorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTask(input: CreateTaskInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Creating task',
      name: input.name,
      assigneeActorId: input.assigneeActorId,
      sessionId: input.sessionId,
    });

    // Look up actor IDs from slugs
    let assigneeActorId: string | null = null;

    if (input.assigneeActorId) {
      const assigneeActor = await this.actorService.getActorByIdOrSlug(input.assigneeActorId);
      if (!assigneeActor) {
        throw new Error(`Assignee actor not found: ${input.assigneeActorId}`);
      }
      assigneeActorId = assigneeActor.id;
    }

    // createdBy is required - look up the actor first by id then slug
    const createdByActor = await this.actorService.getActorByIdOrSlug(input.createdByActorId);
    if (!createdByActor) {
      throw new Error(`Creator actor not found: ${input.createdByActorId}`);
    }
    const createdByActorId = createdByActor.id;

    const task = this.taskRepository.create({
      name: input.name,
      description: input.description,
      assigneeActorId,
      sessionId: input.sessionId ?? null,
      status: TaskStatus.NOT_STARTED,
      createdByActorId,
    });

    const savedTask = await this.taskRepository.save(task);

    // Handle tags if provided
    if (input.tagNames && input.tagNames.length > 0) {
      const tags = await this.findOrCreateTags(input.tagNames);
      savedTask.tags = tags;
      await this.taskRepository.save(savedTask);
    }

    // Handle dependencies if provided
    if (input.dependsOnIds && input.dependsOnIds.length > 0) {
      const dependencyTasks = await this.taskRepository.findBy({
        id: In(input.dependsOnIds),
      });
      if (dependencyTasks.length !== input.dependsOnIds.length) {
        throw new Error('One or more dependency tasks not found');
      }
      savedTask.dependsOn = dependencyTasks;
      await this.taskRepository.save(savedTask);
    }

    // Reload with relations
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: savedTask.id },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(savedTask.id);
    }

    this.logger.log({
      message: 'Task created',
      taskId: taskWithRelations.id,
      name: taskWithRelations.name,
    });

    this.eventEmitter.emit('task.created', new TaskCreatedEvent(taskWithRelations));
    return this.mapTaskToResult(taskWithRelations);
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Updating task',
      taskId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Apply partial updates
    if (input.name !== undefined) task.name = input.name;
    if (input.description !== undefined) task.description = input.description;
    if (input.sessionId !== undefined) task.sessionId = input.sessionId ?? null;

    // Look up actor IDs from slugs for assignee and createdBy
    if (input.assigneeActorId !== undefined) {
      if (input.assigneeActorId === null) {
        task.assigneeActorId = null; // defined but null means they're removing assignee
      } else {
        const assigneeActor = await this.actorService.getActorByIdOrSlug(input.assigneeActorId);
        if (assigneeActor) {
          task.assigneeActorId = assigneeActor.id;
        } else {
          // TODO: Assignee doesn't exist. Should we throw?
        }
      }
    }

    // Handle tags if provided
    if (input.tagNames !== undefined) {
      if (input.tagNames.length === 0) {
        task.tags = [];
      } else {
        task.tags = await this.findOrCreateTags(input.tagNames);
      }
    }

    // Handle dependencies if provided
    if (input.dependsOnIds !== undefined) {
      if (input.dependsOnIds.length === 0) {
        task.dependsOn = [];
      } else {
        const dependencyTasks = await this.taskRepository.findBy({
          id: In(input.dependsOnIds),
        });
        if (dependencyTasks.length !== input.dependsOnIds.length) {
          throw new Error('One or more dependency tasks not found');
        }
        task.dependsOn = dependencyTasks;
      }
    }

    const updatedTask = await this.taskRepository.save(task);

    // Reload with relations to ensure we have updated tags
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.logger.log({
      message: 'Task updated',
      taskId: taskWithRelations.id,
    });

    this.eventEmitter.emit('task.updated', new TaskUpdatedEvent(taskWithRelations));
    return this.mapTaskToResult(taskWithRelations);
  }

  async assignTask(taskId: string, input: AssignTaskInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Assigning task',
      taskId,
      assigneeActorId: input.assigneeActorId,
      sessionId: input.sessionId,
    });

    this.logger.debug(`finding task ${taskId}`);
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });
    if (!task) {
      this.logger.debug(`task ${taskId} not found`);
      throw new TaskNotFoundError(taskId);
    }
    this.logger.debug(`task ${taskId} found`);

    // Update assignee
    task.assigneeActorId = input.assigneeActorId;
    task.assigneeActor = undefined;

    // Update session if any
    if (input.sessionId !== undefined) {
      task.sessionId = input.sessionId || null;
    }
    this.logger.debug(`task ready to save:`, task)
    const assignedTask = await this.taskRepository.save(task);
    this.logger.debug(`saved task: ${assignedTask}`);

    // Reload with relations
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });
    this.logger.debug(`task from db`, taskWithRelations);

    this.logger.log({
      message: 'Task assigned',
      taskId: assignedTask.id,
      assignee: taskWithRelations?.assignee,
      sessionId: assignedTask.sessionId,
    });

    this.eventEmitter.emit('task.assigned', new TaskAssignedEvent(taskWithRelations!));
    return this.mapTaskToResult(taskWithRelations!);
  }

  async deleteTask(taskId: string): Promise<void> {
    this.logger.log({
      message: 'Deleting task',
      taskId,
    });

    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    await this.taskRepository.softRemove(task);

    this.logger.log({
      message: 'Task deleted',
      taskId,
    });

    this.eventEmitter.emit('task.deleted', new TaskDeletedEvent(taskId));
  }

  async listTasks(input: ListTasksInput): Promise<ListTasksResult> {
    this.logger.log({
      message: 'Listing tasks',
      filters: { assignee: input.assignee, sessionId: input.sessionId, tag: input.tag },
      page: input.page,
      limit: input.limit,
    });

    const skip = (input.page - 1) * input.limit;

    // If tag filter is provided, use query builder for join
    if (input.tag) {
      const queryBuilder = this.taskRepository
        .createQueryBuilder('task')
        .leftJoinAndSelect('task.comments', 'comments')
        .leftJoinAndSelect('comments.commenterActor', 'commenterActor')
        .leftJoinAndSelect('task.tags', 'tags')
        .leftJoinAndSelect('task.assigneeActor', 'assigneeActor')
        .leftJoinAndSelect('task.createdByActor', 'createdByActor')
        .innerJoin('task.tags', 'filterTag')
        .where('filterTag.name = :tagName', { tagName: input.tag });

      if (input.assignee) {
        queryBuilder.andWhere('assigneeActor.slug = :assignee', { assignee: input.assignee });
      }
      if (input.sessionId) {
        queryBuilder.andWhere('task.sessionId = :sessionId', { sessionId: input.sessionId });
      }

      queryBuilder
        .orderBy('task.updatedAt', 'DESC')
        .skip(skip)
        .take(input.limit);

      const [tasks, total] = await queryBuilder.getManyAndCount();

      this.logger.log({
        message: 'Tasks listed',
        count: tasks.length,
        total,
        page: input.page,
      });

      return {
        items: tasks.map((task) => this.mapTaskToResult(task)),
        total,
        page: input.page,
        limit: input.limit,
      };
    }

    // Standard filtering - need to use query builder for assignee filtering by slug
    const queryBuilder = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.comments', 'comments')
      .leftJoinAndSelect('comments.commenterActor', 'commenterActor')
      .leftJoinAndSelect('task.tags', 'tags')
      .leftJoinAndSelect('task.dependsOn', 'dependsOn')
      .leftJoinAndSelect('task.assigneeActor', 'assigneeActor')
      .leftJoinAndSelect('task.createdByActor', 'createdByActor');

    if (input.assignee) {
      queryBuilder.andWhere('assigneeActor.slug = :assignee', { assignee: input.assignee });
    }
    if (input.sessionId) {
      queryBuilder.andWhere('task.sessionId = :sessionId', { sessionId: input.sessionId });
    }

    queryBuilder
      .orderBy('task.updatedAt', 'DESC')
      .skip(skip)
      .take(input.limit);

    const [tasks, total] = await queryBuilder.getManyAndCount();

    this.logger.log({
      message: 'Tasks listed',
      count: tasks.length,
      total,
      page: input.page,
    });

    return {
      items: tasks.map((task) => this.mapTaskToResult(task)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async getTaskById(taskId: string): Promise<TaskResult> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    return this.mapTaskToResult(task);
  }

  async addComment(taskId: string, input: CreateCommentInput): Promise<CommentResult> {
    this.logger.log({
      message: 'Adding comment',
      taskId,
    });

    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const comment = this.commentRepository.create({
      task,
      commenterActorId: input.commenterActorId,
      content: input.content,
    });

    const savedComment = await this.commentRepository.save(comment);

    // Reload with actor relation
    const commentWithRelations = await this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: ['commenterActor', 'task'],
    });

    this.logger.log({
      message: 'Comment added',
      commentId: savedComment.id,
      taskId,
    });

    this.eventEmitter.emit('comment.added', new CommentAddedEvent(commentWithRelations!));
    return this.mapCommentToResult(commentWithRelations!);
  }

  async changeStatus(taskId: string, input: ChangeStatusInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Changing task status',
      taskId,
      status: input.status,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Validate status transition rules
    if (input.status === TaskStatus.IN_PROGRESS && !task.assigneeActorId) {
      throw new InvalidStatusTransitionError(
        task.status,
        input.status,
        'Task must be assigned before moving to in progress',
      );
    }

    if (input.status === TaskStatus.DONE) {
      const hasExistingComments = task.comments?.length > 0;

      if (!input.comment && !hasExistingComments) {
        throw new CommentRequiredError();
      }
    }

    // If changing to DONE and comment is provided, add the comment
    if (input.status === TaskStatus.DONE && input.comment) {
      await this.commentRepository.save(
        this.commentRepository.create({
          task,
          commenterActorId: task.assigneeActorId,
          content: input.comment,
        }),
      );
    }

    task.status = input.status;
    const updatedTask = await this.taskRepository.save(task);

    // Reload to get updated comments if any were added
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.logger.log({
      message: 'Task status changed',
      taskId,
      status: taskWithRelations.status,
    });

    this.eventEmitter.emit('task.statusChanged', new TaskStatusChangedEvent(taskWithRelations));
    return this.mapTaskToResult(taskWithRelations);
  }

  async createTag(input: CreateTagInput): Promise<TagResult> {
    this.logger.log({
      message: 'Creating tag',
      tagName: input.name,
    });

    // Check if tag already exists (case-insensitive)
    let tag = await this.tagRepository.findOne({ where: { name: input.name } });

    if (!tag) {
      // Create new tag with random color
      tag = this.tagRepository.create({
        name: input.name,
        color: getRandomTagColor(),
      });
      tag = await this.tagRepository.save(tag);
      this.logger.log({
        message: 'Tag created',
        tagId: tag.id,
        tagName: tag.name,
        color: tag.color,
      });
    } else {
      this.logger.log({
        message: 'Tag already exists',
        tagId: tag.id,
        tagName: tag.name,
      });
    }

    return this.mapTagToResult(tag);
  }

  async addTagToTask(taskId: string, input: AddTagInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Adding tag to task',
      taskId,
      tagName: input.name,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Find or create the tag (case-insensitive)
    let tag = await this.tagRepository.findOne({ where: { name: input.name } });

    if (!tag) {
      tag = this.tagRepository.create({
        name: input.name,
        color: input.color ?? getRandomTagColor(),
      });
      tag = await this.tagRepository.save(tag);
      this.logger.log({
        message: 'Tag created',
        tagId: tag.id,
        tagName: tag.name,
      });
    }

    // Add tag to task if not already present
    if (!task.tags.some((t) => t.id === tag.id)) {
      task.tags.push(tag);
      await this.taskRepository.save(task);
      this.logger.log({
        message: 'Tag added to task',
        taskId,
        tagId: tag.id,
      });
    }

    // Reload with relations
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.eventEmitter.emit('task.updated', new TaskUpdatedEvent(taskWithRelations));
    return this.mapTaskToResult(taskWithRelations);
  }

  async removeTagFromTask(taskId: string, tagId: string): Promise<TaskResult> {
    this.logger.log({
      message: 'Removing tag from task',
      taskId,
      tagId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    task.tags = task.tags.filter((tag) => tag.id !== tagId);
    await this.taskRepository.save(task);

    this.logger.log({
      message: 'Tag removed from task',
      taskId,
      tagId,
    });

    // Check if tag is now orphaned and clean it up
    await this.cleanupOrphanedTag(tagId);

    // Reload with relations to get updated task
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.commenterActor', 'tags', 'dependsOn', 'assigneeActor', 'createdByActor'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.eventEmitter.emit('task.updated', new TaskUpdatedEvent(taskWithRelations));
    return this.mapTaskToResult(taskWithRelations);
  }

  async getAllTags(): Promise<TagResult[]> {
    this.logger.log({ message: 'Getting all tags' });

    const tags = await this.tagRepository.find({
      order: { name: 'ASC' },
    });

    this.logger.log({
      message: 'Tags retrieved',
      count: tags.length,
    });

    return tags.map((tag) => this.mapTagToResult(tag));
  }

  async deleteTag(tagId: string): Promise<void> {
    this.logger.log({
      message: 'Deleting tag',
      tagId,
    });

    const result = await this.tagRepository.softDelete(tagId);

    if (result.affected === 0) {
      this.logger.warn({
        message: 'Tag not found for deletion',
        tagId,
      });
    } else {
      this.logger.log({
        message: 'Tag deleted',
        tagId,
      });
    }
  }

  private async cleanupOrphanedTag(tagId: string): Promise<void> {
    this.logger.log({
      message: 'Checking if tag is orphaned',
      tagId,
    });

    const tagWithTasks = await this.tagRepository.findOne({
      where: { id: tagId },
      relations: ['tasks'],
    });

    if (!tagWithTasks) {
      this.logger.warn({
        message: 'Tag not found for cleanup check',
        tagId,
      });
      return;
    }

    if (tagWithTasks.tasks.length === 0) {
      this.logger.log({
        message: 'Tag is orphaned, cleaning up',
        tagId,
        tagName: tagWithTasks.name,
      });

      await this.tagRepository.softDelete(tagId);

      this.logger.log({
        message: 'Orphaned tag cleaned up',
        tagId,
      });
    } else {
      this.logger.log({
        message: 'Tag still has tasks, keeping it',
        tagId,
        taskCount: tagWithTasks.tasks.length,
      });
    }
  }

  private mapTaskToResult(task: TaskEntity): TaskResult {
    if (!task.createdByActor) {
      throw new Error(`Task ${task.id} is missing createdByActor relation`);
    }

    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      assignee: task.assignee,
      assigneeActor: task.assigneeActor ? this.mapActorToResult(task.assigneeActor) : null,
      sessionId: task.sessionId,
      comments: task.comments.map((c) => this.mapCommentToResult(c)),
      tags: (task.tags || []).map((t) => this.mapTagToResult(t)),
      createdByActor: this.mapActorToResult(task.createdByActor),
      dependsOnIds: (task.dependsOn || []).map((t) => t.id),
      rowVersion: task.rowVersion,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      deletedAt: task.deletedAt,
    };
  }

  private mapCommentToResult(comment: CommentEntity): CommentResult {
    return {
      id: comment.id,
      taskId: comment.taskId,
      commenterName: comment.commenterName,
      commenterActor: comment.commenterActor ? this.mapActorToResult(comment.commenterActor) : null,
      content: comment.content,
      createdAt: comment.createdAt,
    };
  }

  private mapActorToResult(actor: ActorEntity): ActorResult {
    return {
      id: actor.id,
      type: actor.type,
      slug: actor.slug,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
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

  /**
   * Helper method to find or create tags by name (case-insensitive)
   */
  private async findOrCreateTags(tagNames: string[]): Promise<TagEntity[]> {
    const tags: TagEntity[] = [];

    for (const tagName of tagNames) {
      const normalizedName = tagName.trim();
      if (!normalizedName) continue;

      // Try to find existing tag (case-insensitive due to NOCASE collation)
      let tag = await this.tagRepository.findOne({
        where: { name: normalizedName }
      });

      if (!tag) {
        // Create new tag with normalized name and random color
        tag = this.tagRepository.create({
          name: normalizedName,
          color: getRandomTagColor(),
        });
        tag = await this.tagRepository.save(tag);
        this.logger.log({
          message: 'Tag created',
          tagId: tag.id,
          tagName: tag.name,
          color: tag.color,
        });
      }

      tags.push(tag);
    }

    return tags;
  }
}
