import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, In } from 'typeorm';
import { TaskEntity } from './task.entity';
import { TaskStatus } from './enums';
import { CommentEntity } from './comment.entity';
import { ArtefactEntity } from './artefact.entity';
import { InputRequestEntity } from './input-request.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import {
  CreateTaskInput,
  CreateTaskInThreadInput,
  UpdateTaskInput,
  AssignTaskInput,
  ChangeStatusInput,
  CreateCommentInput,
  CreateArtefactInput,
  ListTasksInput,
  AddTagInput,
  CreateInputRequestInput,
  AnswerInputRequestInput,
  TaskResult,
  CommentResult,
  ArtefactResult,
  ListTasksResult,
  TagResult,
  ActorResult,
  InputRequestResult,
  SearchTasksInput,
  TaskSearchResult,
} from './dto/service/tasks.service.types';
import {
  TaskNotFoundError,
  InvalidStatusTransitionError,
  CommentRequiredError,
  ActorNotFoundError,
  TaskIsThreadParentError,
  InputRequestSelfAssignmentError,
} from './errors/tasks.errors';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskAssignedEvent,
  TaskDeletedEvent,
  CommentAddedEvent,
  ArtefactAddedEvent,
  TaskStatusChangedEvent,
  InputRequestAnsweredEvent,
} from './events/tasks.events';
import { MetaService } from '../meta/meta.service';
import { TagEntity } from '../meta/tag.entity';
import { ActorService } from 'src/identity-provider/actor.service';
import { SearchService } from '../search/search.service';
import { AgentRunsService } from '../agent-runs/agent-runs.service';
import { ThreadsService } from '../threads/threads.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentRepository: Repository<CommentEntity>,
    @InjectRepository(ArtefactEntity)
    private readonly artefactRepository: Repository<ArtefactEntity>,
    @InjectRepository(InputRequestEntity)
    private readonly inputRequestRepository: Repository<InputRequestEntity>,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
    private readonly actorService: ActorService,
    private readonly metaService: MetaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly searchService: SearchService,
    private readonly agentRunsService: AgentRunsService,
    private readonly threadsService: ThreadsService,
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
      const assigneeActor = await this.actorService.getActorByIdOrSlug(
        input.assigneeActorId,
      );
      if (!assigneeActor) {
        throw new Error(`Assignee actor not found: ${input.assigneeActorId}`);
      }
      assigneeActorId = assigneeActor.id;
    }

    // createdBy is required - look up the actor first by id then slug
    const createdByActor = await this.actorService.getActorByIdOrSlug(
      input.createdByActorId,
    );
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
      const tags = await this.metaService.findOrCreateTagEntities(
        input.tagNames,
      );
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
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(savedTask.id);
    }

    this.logger.log({
      message: 'Task created',
      taskId: taskWithRelations.id,
      name: taskWithRelations.name,
    });

    this.eventEmitter.emit(
      TaskCreatedEvent.INTERNAL,
      new TaskCreatedEvent(
        { id: taskWithRelations.createdByActorId },
        taskWithRelations,
      ),
    );
    return this.mapTaskToResult(taskWithRelations);
  }

  async createTaskInThread(
    input: CreateTaskInThreadInput,
  ): Promise<TaskResult> {
    this.logger.log({
      message: 'Creating task in thread',
      name: input.name,
      runId: input.runId,
    });

    // First, retrieve the agent run
    const agentRun = await this.agentRunsService.getAgentRunById(input.runId);

    // Enforce that the caller must be the actor in the agent run
    if (agentRun.actorId !== input.createdByActorId) {
      throw new Error(
        `Unauthorized: caller ${input.createdByActorId} is not the actor in agent run ${input.runId}`,
      );
    }

    // Get the parent task from the agent run
    const parentTaskId = agentRun.parentTaskId;

    // Create the task using the existing method
    const task = await this.createTask({
      name: input.name,
      description: input.description,
      assigneeActorId: input.assigneeActorId,
      sessionId: input.sessionId,
      createdByActorId: input.createdByActorId,
      tagNames: input.tagNames,
      dependsOnIds: input.dependsOnIds,
    });

    // Try to find a thread where the parent task is
    let thread = await this.threadsService.findThreadByTaskId(parentTaskId);

    if (thread) {
      // Thread exists, attach the task to it
      this.logger.log({
        message: 'Attaching task to existing thread',
        taskId: task.id,
        threadId: thread.id,
      });
      await this.threadsService.attachTask(thread.id, task.id);
    } else {
      // Thread doesn't exist, create it and attach both tasks
      this.logger.log({
        message: 'Creating new thread for tasks',
        parentTaskId,
        newTaskId: task.id,
      });
      thread = await this.threadsService.createThread({
        createdByActorId: input.createdByActorId,
        parentTaskId: parentTaskId,
        taskIds: [task.id],
      });
    }

    this.logger.log({
      message: 'Task created in thread',
      taskId: task.id,
      threadId: thread.id,
      runId: input.runId,
    });

    return task;
  }

  async updateTask(
    taskId: string,
    input: UpdateTaskInput,
    actorId: string,
  ): Promise<TaskResult> {
    this.logger.log({
      message: 'Updating task',
      taskId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
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
        const assigneeActor = await this.actorService.getActorByIdOrSlug(
          input.assigneeActorId,
        );
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
        task.tags = await this.metaService.findOrCreateTagEntities(
          input.tagNames,
        );
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
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.logger.log({
      message: 'Task updated',
      taskId: taskWithRelations.id,
    });

    this.eventEmitter.emit(
      TaskUpdatedEvent.INTERNAL,
      new TaskUpdatedEvent({ id: actorId }, taskWithRelations),
    );
    return this.mapTaskToResult(taskWithRelations);
  }

  async assignTask(
    taskId: string,
    input: AssignTaskInput,
    actorId: string,
  ): Promise<TaskResult> {
    this.logger.log({
      message: 'Assigning task',
      taskId,
      assigneeActorId: input.assigneeActorId,
      sessionId: input.sessionId,
    });

    this.logger.debug(`finding task ${taskId}`);
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });
    if (!task) {
      this.logger.debug(`task ${taskId} not found`);
      throw new TaskNotFoundError(taskId);
    }
    this.logger.debug(`task ${taskId} found`);

    if (task.assigneeActorId === input.assigneeActorId) {
      // Already assigned, no op
      return this.mapTaskToResult(task);
    }

    // Update assignee
    task.assigneeActorId = input.assigneeActorId;
    task.assigneeActor = undefined;

    // Update session if any
    if (input.sessionId !== undefined) {
      task.sessionId = input.sessionId || null;
    }
    this.logger.debug(`task ready to save:`, task);
    const assignedTask = await this.taskRepository.save(task);
    this.logger.debug(`saved task: ${assignedTask}`);

    // Reload with relations
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });
    this.logger.debug(`task from db`, taskWithRelations);

    this.logger.log({
      message: 'Task assigned',
      taskId: assignedTask.id,
      assignee: taskWithRelations?.assignee,
      sessionId: assignedTask.sessionId,
    });

    this.eventEmitter.emit(
      TaskAssignedEvent.INTERNAL,
      new TaskAssignedEvent({ id: actorId }, taskWithRelations!),
    );
    return this.mapTaskToResult(taskWithRelations!);
  }

  async deleteTask(taskId: string, actorId: string): Promise<void> {
    this.logger.log({
      message: 'Deleting task',
      taskId,
    });

    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Check if task is a parent of any threads
    const threadsWithParent = await this.threadsService.findThreadsByParentTaskId(taskId);
    if (threadsWithParent.length > 0) {
      throw new TaskIsThreadParentError(taskId, threadsWithParent.length);
    }

    await this.taskRepository.softRemove(task);

    this.logger.log({
      message: 'Task deleted',
      taskId,
    });

    this.eventEmitter.emit(
      TaskDeletedEvent.INTERNAL,
      new TaskDeletedEvent({ id: actorId }, taskId),
    );
  }

  async listTasks(input: ListTasksInput): Promise<ListTasksResult> {
    this.logger.log({
      message: 'Listing tasks',
      filters: {
        assignee: input.assignee,
        sessionId: input.sessionId,
        tag: input.tag,
      },
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
        .leftJoinAndSelect('task.artefacts', 'artefacts')
        .leftJoinAndSelect('task.inputRequests', 'inputRequests')
        .leftJoinAndSelect('task.tags', 'tags')
        .leftJoinAndSelect('task.assigneeActor', 'assigneeActor')
        .leftJoinAndSelect('task.createdByActor', 'createdByActor')
        .innerJoin('task.tags', 'filterTag')
        .where('filterTag.name = :tagName', { tagName: input.tag });

      if (input.assignee) {
        queryBuilder.andWhere('assigneeActor.slug = :assignee', {
          assignee: input.assignee,
        });
      }
      if (input.sessionId) {
        queryBuilder.andWhere('task.sessionId = :sessionId', {
          sessionId: input.sessionId,
        });
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
      .leftJoinAndSelect('task.artefacts', 'artefacts')
      .leftJoinAndSelect('task.inputRequests', 'inputRequests')
      .leftJoinAndSelect('task.tags', 'tags')
      .leftJoinAndSelect('task.dependsOn', 'dependsOn')
      .leftJoinAndSelect('task.assigneeActor', 'assigneeActor')
      .leftJoinAndSelect('task.createdByActor', 'createdByActor');

    if (input.assignee) {
      queryBuilder.andWhere('assigneeActor.slug = :assignee', {
        assignee: input.assignee,
      });
    }
    if (input.sessionId) {
      queryBuilder.andWhere('task.sessionId = :sessionId', {
        sessionId: input.sessionId,
      });
    }

    queryBuilder.orderBy('task.updatedAt', 'DESC').skip(skip).take(input.limit);

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
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    return this.mapTaskToResult(task);
  }

  async addComment(
    taskId: string,
    input: CreateCommentInput,
  ): Promise<CommentResult> {
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

    this.eventEmitter.emit(
      CommentAddedEvent.INTERNAL,
      new CommentAddedEvent(
        { id: input.commenterActorId },
        commentWithRelations!,
      ),
    );
    return this.mapCommentToResult(commentWithRelations!);
  }

  async addArtefact(
    taskId: string,
    input: CreateArtefactInput,
    actorId: string,
  ): Promise<ArtefactResult> {
    this.logger.log({
      message: 'Adding artefact',
      taskId,
    });

    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const artefact = this.artefactRepository.create({
      task,
      name: input.name,
      link: input.link,
    });

    const savedArtefact = await this.artefactRepository.save(artefact);

    // Reload with task relation
    const artefactWithRelations = await this.artefactRepository.findOne({
      where: { id: savedArtefact.id },
      relations: ['task'],
    });

    this.logger.log({
      message: 'Artefact added',
      artefactId: savedArtefact.id,
      taskId,
    });

    this.eventEmitter.emit(
      ArtefactAddedEvent.INTERNAL,
      new ArtefactAddedEvent({ id: actorId }, artefactWithRelations!),
    );
    return this.mapArtefactToResult(artefactWithRelations!);
  }

  async changeStatus(
    taskId: string,
    input: ChangeStatusInput,
    actorId: string,
  ): Promise<TaskResult> {
    this.logger.log({
      message: 'Changing task status',
      taskId,
      status: input.status,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
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
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.logger.log({
      message: 'Task status changed',
      taskId,
      status: taskWithRelations.status,
    });

    this.eventEmitter.emit(
      TaskStatusChangedEvent.INTERNAL,
      new TaskStatusChangedEvent({ id: actorId }, taskWithRelations),
    );
    return this.mapTaskToResult(taskWithRelations);
  }

  async addTagToTask(
    taskId: string,
    input: AddTagInput,
    actorId: string,
  ): Promise<TaskResult> {
    this.logger.log({
      message: 'Adding tag to task',
      taskId,
      tagName: input.name,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Find or create the tag using MetaService
    const tag = await this.metaService.findOrCreateTagEntity(input.name);

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
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.eventEmitter.emit(
      TaskUpdatedEvent.INTERNAL,
      new TaskUpdatedEvent({ id: actorId }, taskWithRelations),
    );
    return this.mapTaskToResult(taskWithRelations);
  }

  async removeTagFromTask(
    taskId: string,
    tagId: string,
    actorId,
  ): Promise<TaskResult> {
    this.logger.log({
      message: 'Removing tag from task',
      taskId,
      tagId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
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

    // Check if tag is now orphaned and clean it up using MetaService
    await this.metaService.cleanupOrphanedTag(tagId);

    // Reload with relations to get updated task
    const taskWithRelations = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });

    if (!taskWithRelations) {
      throw new TaskNotFoundError(taskId);
    }

    this.eventEmitter.emit(
      TaskUpdatedEvent.INTERNAL,
      new TaskUpdatedEvent({ id: actorId }, taskWithRelations),
    );
    return this.mapTaskToResult(taskWithRelations);
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
      assigneeActor: task.assigneeActor
        ? this.mapActorToResult(task.assigneeActor)
        : null,
      sessionId: task.sessionId,
      comments: task.comments.map((c) => this.mapCommentToResult(c)),
      artefacts: (task.artefacts || []).map((a) => this.mapArtefactToResult(a)),
      inputRequests: (task.inputRequests || []).map((ir) =>
        this.mapInputRequestToResult(ir),
      ),
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
      commenterActor: comment.commenterActor
        ? this.mapActorToResult(comment.commenterActor)
        : null,
      content: comment.content,
      createdAt: comment.createdAt,
    };
  }

  private mapArtefactToResult(artefact: ArtefactEntity): ArtefactResult {
    return {
      id: artefact.id,
      taskId: artefact.taskId,
      name: artefact.name,
      link: artefact.link,
      createdAt: artefact.createdAt,
    };
  }

  private mapActorToResult(actor: ActorEntity): ActorResult {
    return {
      id: actor.id,
      type: actor.type,
      slug: actor.slug,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
      introduction: actor.introduction,
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

  private mapInputRequestToResult(
    inputRequest: InputRequestEntity,
  ): InputRequestResult {
    return {
      id: inputRequest.id,
      taskId: inputRequest.taskId,
      askedByActorId: inputRequest.askedByActorId,
      assignedToActorId: inputRequest.assignedToActorId,
      question: inputRequest.question,
      answer: inputRequest.answer,
      resolvedAt: inputRequest.resolvedAt,
      createdAt: inputRequest.createdAt,
      updatedAt: inputRequest.updatedAt,
    };
  }

  async createInputRequest(
    input: CreateInputRequestInput,
  ): Promise<InputRequestResult> {
    this.logger.log({
      message: 'Creating input request',
      taskId: input.taskId,
      assignedToActorId: input.assignedToActorId,
    });

    // Get task to find creator if assignedToActorId is not provided
    const task = await this.taskRepository.findOne({
      where: { id: input.taskId },
      relations: ['createdByActor'],
    });

    if (!task) {
      throw new TaskNotFoundError(input.taskId);
    }

    // Default to task creator if assignedToActorId is not provided
    const assignedToActorId = input.assignedToActorId ?? task.createdByActorId;

    if (input.askedByActorId === assignedToActorId) {
      throw new InputRequestSelfAssignmentError(
        input.askedByActorId,
        assignedToActorId,
      );
    }

    const inputRequest = this.inputRequestRepository.create({
      taskId: input.taskId,
      askedByActorId: input.askedByActorId,
      assignedToActorId: assignedToActorId,
      question: input.question,
      answer: null,
      resolvedAt: null,
    });

    try {
      const savedInputRequest =
        await this.inputRequestRepository.save(inputRequest);

      this.logger.log({
        message: 'Input request created',
        inputRequestId: savedInputRequest.id,
        taskId: input.taskId,
        assignedToActorId: assignedToActorId,
      });

      // Reload with relations
      const taskWithRelations = await this.taskRepository.findOne({
        where: { id: input.taskId },
        relations: [
          'comments',
          'comments.commenterActor',
          'inputRequests',
          'tags',
          'dependsOn',
          'assigneeActor',
          'createdByActor',
        ],
      });

      if (!taskWithRelations) {
        throw new TaskNotFoundError(input.taskId);
      }

      this.eventEmitter.emit(
        TaskUpdatedEvent.INTERNAL,
        new TaskUpdatedEvent({ id: input.askedByActorId }, taskWithRelations),
      );
      return this.mapInputRequestToResult(savedInputRequest);
    } catch (error: any) {
      // If save fails, check what entity doesn't exist to provide a proper error message
      this.logger.debug({
        message: 'Input request creation failed, checking entities',
        error: error.message,
      });

      // Check if askedBy actor exists
      const askedByActor = await this.actorRepository.findOne({
        where: { id: input.askedByActorId },
      });
      if (!askedByActor) {
        throw new ActorNotFoundError(input.askedByActorId);
      }

      // Check if assignedTo actor exists
      const assignedToActor = await this.actorRepository.findOne({
        where: { id: assignedToActorId },
      });
      if (!assignedToActor) {
        throw new ActorNotFoundError(assignedToActorId);
      }

      // If all entities exist but save still failed, rethrow the original error
      throw error;
    }
  }

  async answerInputRequest(
    taskId: string,
    inputRequestId: string,
    input: AnswerInputRequestInput,
    actorId: string,
  ): Promise<InputRequestResult> {
    this.logger.log({
      message: 'Answering input request',
      taskId,
      inputRequestId,
    });

    const inputRequest = await this.inputRequestRepository.findOne({
      where: { id: inputRequestId, taskId },
    });

    if (!inputRequest) {
      throw new Error(
        `Input request ${inputRequestId} not found for task ${taskId}`,
      );
    }

    inputRequest.answer = input.answer;
    inputRequest.resolvedAt = new Date();

    const updatedInputRequest =
      await this.inputRequestRepository.save(inputRequest);

    this.logger.log({
      message: 'Input request answered',
      inputRequestId,
      taskId,
    });

    this.eventEmitter.emit(
      InputRequestAnsweredEvent.INTERNAL,
      new InputRequestAnsweredEvent({ id: actorId }, updatedInputRequest),
    );

    return this.mapInputRequestToResult(updatedInputRequest);
  }

  async searchTasks(input: SearchTasksInput): Promise<TaskSearchResult[]> {
    this.logger.log({
      message: 'Searching tasks',
      query: input.query,
      limit: input.limit,
      threshold: input.threshold,
    });

    // Get all tasks - we need to search across all of them
    const tasks = await this.taskRepository.find({
      relations: ['comments'],
    });

    // Map tasks to searchable format with combined comment text
    const searchableItems = tasks.map((task) => ({
      id: task.id,
      name: task.name,
      description: task.description,
      // Combine all comments into a searchable text field
      commentsText: task.comments?.map((c) => c.content).join(' ') || '',
    }));

    // Use the generic search service
    // Primary field is 'name', secondary is a combination of description and comments
    const searchResults = this.searchService.search({
      items: searchableItems,
      primaryField: 'name',
      secondaryField: 'description',
      query: input.query,
      limit: input.limit,
      threshold: input.threshold,
    });

    this.logger.log({
      message: 'Search completed',
      resultCount: searchResults.length,
    });

    // Map to TaskSearchResult
    return searchResults.map((result) => ({
      id: result.id,
      name: result.primaryField,
      score: result.score,
    }));
  }
}
