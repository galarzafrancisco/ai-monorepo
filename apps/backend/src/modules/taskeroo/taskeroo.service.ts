import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './task.entity';
import { Comment } from './comment.entity';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';
import { AssignTaskDto } from './assign-task.dto';
import { CreateCommentDto } from './create-comment.dto';
import { ChangeStatusDto } from './change-status.dto';
import {
  TaskNotFoundError,
  TaskNotAssignedError,
  InvalidStatusTransitionError,
  CommentRequiredError,
} from './taskeroo.errors';
import { TaskerooGateway } from './taskeroo.gateway';

@Injectable()
export class TaskerooService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @Inject(forwardRef(() => TaskerooGateway))
    private readonly gateway: TaskerooGateway,
  ) {}

  async createTask(dto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepository.create({
      name: dto.name,
      description: dto.description,
      assignee: dto.assignee ?? null,
      sessionId: dto.sessionId ?? null,
      status: TaskStatus.NOT_STARTED,
    });

    const savedTask = await this.taskRepository.save(task);

    // Reload with relations to ensure comments array is included
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: savedTask.id },
      relations: ['comments'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(savedTask.id);
    }

    this.gateway.emitTaskCreated(taskWithRelations);
    return taskWithRelations;
  }

  async updateTask(taskId: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    task.description = dto.description;
    const updatedTask = await this.taskRepository.save(task);
    this.gateway.emitTaskUpdated(updatedTask);
    return updatedTask;
  }

  async assignTask(taskId: string, dto: AssignTaskDto): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Allow setting assignee to null or empty string to unassign
    task.assignee = dto.assignee || null;
    const assignedTask = await this.taskRepository.save(task);
    this.gateway.emitTaskAssigned(assignedTask);
    return assignedTask;
  }

  async deleteTask(taskId: string): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    await this.taskRepository.remove(task);
    this.gateway.emitTaskDeleted(taskId);
  }

  async listAllTasks(): Promise<Task[]> {
    return await this.taskRepository.find({
      relations: ['comments'],
      order: { createdAt: 'DESC' },
    });
  }

  async listTasksByAssignee(assignee: string): Promise<Task[]> {
    return await this.taskRepository.find({
      where: { assignee },
      relations: ['comments'],
      order: { createdAt: 'DESC' },
    });
  }

  async listTasksBySessionId(sessionId: string): Promise<Task[]> {
    return await this.taskRepository.find({
      where: { sessionId },
      relations: ['comments'],
      order: { createdAt: 'DESC' },
    });
  }

  async getTaskById(taskId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    return task;
  }

  async addComment(taskId: string, dto: CreateCommentDto): Promise<Comment> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const comment = this.commentRepository.create({
      taskId,
      commenterName: dto.commenterName,
      content: dto.content,
    });

    const savedComment = await this.commentRepository.save(comment);
    this.gateway.emitCommentAdded(savedComment);
    return savedComment;
  }

  async changeStatus(taskId: string, dto: ChangeStatusDto): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments'],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Validate status transition rules
    if (dto.status === TaskStatus.IN_PROGRESS && !task.assignee) {
      throw new InvalidStatusTransitionError(
        task.status,
        dto.status,
        'Task must be assigned before moving to in progress',
      );
    }

    if (dto.status === TaskStatus.DONE && !dto.comment) {
      throw new CommentRequiredError();
    }

    // If changing to DONE and comment is provided, add the comment
    if (dto.status === TaskStatus.DONE && dto.comment) {
      await this.commentRepository.save(
        this.commentRepository.create({
          taskId,
          commenterName: task.assignee || 'System',
          content: dto.comment,
        }),
      );
    }

    task.status = dto.status;
    const updatedTask = await this.taskRepository.save(task);

    // Reload to get updated comments if any were added
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['comments'],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.gateway.emitStatusChanged(taskWithRelations);
    return taskWithRelations;
  }
}
