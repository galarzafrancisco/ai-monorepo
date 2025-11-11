import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { TaskEntity } from './task.entity';
import { TagEntity } from './tag.entity';
import { TaskStatus } from './enums';
import { CommentEntity } from './comment.entity';
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
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTask(input: CreateTaskInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Creating task',
      name: input.name,
      assignee: input.assignee,
      sessionId: input.sessionId,
    });

    const task = this.taskRepository.create({
      name: input.name,
      description: input.description,
      assignee: input.assignee ?? null,
      sessionId: input.sessionId ?? null,
      status: TaskStatus.NOT_STARTED,
    });

    const savedTask = await this.taskRepository.save(task);

    // Reload with relations
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: savedTask.id },
      relations: ['comments', 'tags'],
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
      relations: ['comments', 'tags'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Apply partial updates
    if (input.name !== undefined) task.name = input.name;
    if (input.description !== undefined) task.description = input.description;
    if (input.assignee !== undefined) task.assignee = input.assignee ?? null;
    if (input.sessionId !== undefined) task.sessionId = input.sessionId ?? null;

    const updatedTask = await this.taskRepository.save(task);

    this.logger.log({
      message: 'Task updated',
      taskId: updatedTask.id,
    });

    this.eventEmitter.emit('task.updated', new TaskUpdatedEvent(updatedTask));
    return this.mapTaskToResult(updatedTask);
  }

  async assignTask(taskId: string, input: AssignTaskInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Assigning task',
      taskId,
      assignee: input.assignee,
      sessionId: input.sessionId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'tags'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    task.assignee = input.assignee || null;
    if (input.sessionId !== undefined) {
      task.sessionId = input.sessionId || null;
    }
    const assignedTask = await this.taskRepository.save(task);

    this.logger.log({
      message: 'Task assigned',
      taskId: assignedTask.id,
      assignee: assignedTask.assignee,
      sessionId: assignedTask.sessionId,
    });

    this.eventEmitter.emit('task.assigned', new TaskAssignedEvent(assignedTask));
    return this.mapTaskToResult(assignedTask);
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
      filters: { assignee: input.assignee, sessionId: input.sessionId },
      page: input.page,
      limit: input.limit,
    });

    const where: any = {};
    if (input.assignee) {
      where.assignee = input.assignee;
    }
    if (input.sessionId) {
      where.sessionId = input.sessionId;
    }

    const skip = (input.page - 1) * input.limit;

    const [tasks, total] = await this.taskRepository.findAndCount({
      where,
      relations: ['comments', 'tags'],
      order: { updatedAt: 'DESC' },
      skip,
      take: input.limit,
    });

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
      relations: ['comments', 'tags'],
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
      commenterName: input.commenterName,
    });

    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const comment = this.commentRepository.create({
      task,
      commenterName: input.commenterName,
      content: input.content,
    });

    const savedComment = await this.commentRepository.save(comment);

    this.logger.log({
      message: 'Comment added',
      commentId: savedComment.id,
      taskId,
    });

    this.eventEmitter.emit('comment.added', new CommentAddedEvent(savedComment));
    return this.mapCommentToResult(savedComment);
  }

  async changeStatus(taskId: string, input: ChangeStatusInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Changing task status',
      taskId,
      status: input.status,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'tags'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Validate status transition rules
    if (input.status === TaskStatus.IN_PROGRESS && !task.assignee) {
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
          commenterName: task.assignee || 'System',
          content: input.comment,
        }),
      );
    }

    task.status = input.status;
    const updatedTask = await this.taskRepository.save(task);

    // Reload to get updated comments if any were added
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'tags'],
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

  async addTagToTask(taskId: string, input: AddTagInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Adding tag to task',
      taskId,
      tagName: input.name,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments', 'tags'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Find or create the tag
    let tag = await this.tagRepository.findOne({ where: { name: input.name } });

    if (!tag) {
      tag = this.tagRepository.create({
        name: input.name,
        color: input.color,
        description: input.description,
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
      relations: ['comments', 'tags'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

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
      relations: ['comments', 'tags'],
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

    return this.mapTaskToResult(task);
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

  async listTasksByTag(tagName: string): Promise<TaskResult[]> {
    this.logger.log({
      message: 'Listing tasks by tag',
      tagName,
    });

    const tag = await this.tagRepository.findOne({
      where: { name: tagName },
      relations: ['tasks', 'tasks.comments', 'tasks.tags'],
    });

    if (!tag) {
      return [];
    }

    this.logger.log({
      message: 'Tasks by tag retrieved',
      tagName,
      count: tag.tasks.length,
    });

    return tag.tasks.map((task) => this.mapTaskToResult(task));
  }

  private mapTaskToResult(task: TaskEntity): TaskResult {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      assignee: task.assignee,
      sessionId: task.sessionId,
      comments: task.comments.map((c) => this.mapCommentToResult(c)),
      tags: (task.tags || []).map((t) => this.mapTagToResult(t)),
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
      content: comment.content,
      createdAt: comment.createdAt,
    };
  }

  private mapTagToResult(tag: TagEntity): TagResult {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }
}
