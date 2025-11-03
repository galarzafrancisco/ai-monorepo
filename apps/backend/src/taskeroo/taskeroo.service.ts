import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity, TaskStatus } from './task.entity';
import { CommentEntity } from './comment.entity';
import {
  CreateTaskInput,
  UpdateTaskInput,
  AssignTaskInput,
  ChangeStatusInput,
  CreateCommentInput,
  ListTasksInput,
  TaskResult,
  CommentResult,
  ListTasksResult,
} from './dto/service/taskeroo.service.types';
import {
  TaskNotFoundError,
  InvalidStatusTransitionError,
  CommentRequiredError,
} from './errors/taskeroo.errors';
import { TaskerooGateway } from './taskeroo.gateway';

@Injectable()
export class TaskerooService {
  private readonly logger = new Logger(TaskerooService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentRepository: Repository<CommentEntity>,
    private readonly gateway: TaskerooGateway,
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
      relations: ['comments'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(savedTask.id);
    }

    this.logger.log({
      message: 'Task created',
      taskId: taskWithRelations.id,
      name: taskWithRelations.name,
    });

    this.gateway.emitTaskCreated(taskWithRelations);
    return this.mapTaskToResult(taskWithRelations);
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Updating task',
      taskId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    task.description = input.description;
    const updatedTask = await this.taskRepository.save(task);

    this.logger.log({
      message: 'Task updated',
      taskId: updatedTask.id,
    });

    this.gateway.emitTaskUpdated(updatedTask);
    return this.mapTaskToResult(updatedTask);
  }

  async assignTask(taskId: string, input: AssignTaskInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Assigning task',
      taskId,
      assignee: input.assignee,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    task.assignee = input.assignee || null;
    const assignedTask = await this.taskRepository.save(task);

    this.logger.log({
      message: 'Task assigned',
      taskId: assignedTask.id,
      assignee: assignedTask.assignee,
    });

    this.gateway.emitTaskAssigned(assignedTask);
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

    this.gateway.emitTaskDeleted(taskId);
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
      relations: ['comments'],
      order: { createdAt: 'DESC' },
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
      relations: ['comments'],
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

    this.gateway.emitCommentAdded(savedComment);
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
      relations: ['comments'],
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

    if (input.status === TaskStatus.DONE && !input.comment) {
      throw new CommentRequiredError();
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
      relations: ['comments'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.logger.log({
      message: 'Task status changed',
      taskId,
      status: taskWithRelations.status,
    });

    this.gateway.emitStatusChanged(taskWithRelations);
    return this.mapTaskToResult(taskWithRelations);
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
}
