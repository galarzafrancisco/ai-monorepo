import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
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
  ActorNotFoundError,
  InputRequestSelfAssignmentError,
} from './errors/tasks.errors';
import {
  TaskUpdatedEvent,
  InputRequestAnsweredEvent,
} from './events/tasks.events';
import { MetaService } from '../meta/meta.service';
import { TagEntity } from '../meta/tag.entity';
import { ActorService } from 'src/identity-provider/actor.service';
import { SearchService } from '../search/search.service';
import { ActiveExecutionContextResolverService } from '../executions/active/active-execution-context-resolver.service';
import { ChangeTaskStatusUseCase } from './use-cases/change-task-status.use-case';
import { CreateTaskUseCase } from './use-cases/create-task.use-case';
import { UpdateTaskUseCase } from './use-cases/update-task.use-case';
import { DeleteTaskUseCase } from './use-cases/delete-task.use-case';
import { AssignTaskUseCase } from './use-cases/assign-task.use-case';
import { AddTaskCommentUseCase } from './use-cases/add-task-comment.use-case';
import { CreateInputRequestUseCase } from './use-cases/create-input-request.use-case';
import { AnswerInputRequestUseCase } from './use-cases/answer-input-request.use-case';
import { AddTaskArtefactUseCase } from './use-cases/add-task-artefact.use-case';
import { ChangeTaskTagUseCase } from './use-cases/change-task-tag.use-case';
import { CreateTaskInThreadUseCase } from './use-cases/create-task-in-thread.use-case';

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
    private readonly executionContextResolver: ActiveExecutionContextResolverService,
    private readonly changeTaskStatusUseCase: ChangeTaskStatusUseCase,
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly updateTaskUseCase: UpdateTaskUseCase,
    private readonly deleteTaskUseCase: DeleteTaskUseCase,
    private readonly assignTaskUseCase: AssignTaskUseCase,
    private readonly addTaskCommentUseCase: AddTaskCommentUseCase,
    private readonly createInputRequestUseCase: CreateInputRequestUseCase,
    private readonly answerInputRequestUseCase: AnswerInputRequestUseCase,
    private readonly addTaskArtefactUseCase: AddTaskArtefactUseCase,
    private readonly changeTaskTagUseCase: ChangeTaskTagUseCase,
    private readonly createTaskInThreadUseCase: CreateTaskInThreadUseCase,
  ) {}

  async createTask(input: CreateTaskInput): Promise<TaskResult> {
    this.logger.log({
      message: 'Creating task',
      name: input.name,
      assigneeActorId: input.assigneeActorId,
      sessionId: input.sessionId,
    });

    const taskWithRelations = await this.createTaskUseCase.execute(input);

    this.logger.log({
      message: 'Task created',
      taskId: taskWithRelations.id,
      name: taskWithRelations.name,
    });

    return this.mapTaskToResult(taskWithRelations);
  }

  async createTaskInThread(
    input: CreateTaskInThreadInput,
  ): Promise<TaskResult> {
    this.logger.log({
      message: 'Creating task in thread',
      name: input.name,
      executionId: input.executionId,
      runId: input.runId,
    });

    const context = await this.executionContextResolver.resolveContext(
      input.executionId,
      input.runId,
    );

    // Enforce that the caller must be the actor in the execution context
    if (context.actorId !== input.createdByActorId) {
      throw new Error(
        `Unauthorized: caller ${input.createdByActorId} is not the actor in execution context (execution=${context.executionId}, run=${context.runId})`,
      );
    }

    // Get the parent task from the execution context
    const parentTaskId = context.parentTaskId;

    const task = await this.createTaskInThreadUseCase.execute(
      input,
      parentTaskId,
    );

    this.logger.log({
      message: 'Task created in thread',
      taskId: task.id,
      parentTaskId,
      executionId: input.executionId,
      runId: input.runId,
    });

    return this.mapTaskToResult(task);
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

    const taskWithRelations = await this.updateTaskUseCase.execute(
      taskId,
      input,
      actorId,
    );

    this.logger.log({
      message: 'Task updated',
      taskId: taskWithRelations.id,
    });

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

    const taskWithRelations = await this.assignTaskUseCase.execute(
      taskId,
      input,
      actorId,
    );

    this.logger.log({
      message: 'Task assigned',
      taskId: taskWithRelations.id,
      assignee: taskWithRelations.assignee,
      sessionId: taskWithRelations.sessionId,
    });

    return this.mapTaskToResult(taskWithRelations);
  }

  async deleteTask(taskId: string, actorId: string): Promise<void> {
    this.logger.log({
      message: 'Deleting task',
      taskId,
    });

    await this.deleteTaskUseCase.execute(taskId, actorId);

    this.logger.log({
      message: 'Task deleted',
      taskId,
    });
  }

  async listTasks(input: ListTasksInput): Promise<ListTasksResult> {
    this.logger.log({
      message: 'Listing tasks',
      filters: {
        assignee: input.assignee,
        sessionId: input.sessionId,
        tag: input.tag,
        status: input.status,
        updatedAfter: input.updatedAfter,
      },
      page: input.page,
      limit: input.limit,
    });

    const skip = (input.page - 1) * input.limit;

    const result = await this.taskRepository.manager.transaction(
      async (manager) => {
        const taskRepository = manager.getRepository(TaskEntity);

        if (input.status) {
          const queryBuilder = this.createListTasksQuery(taskRepository, input)
            .orderBy('task.updatedAt', 'DESC')
            .skip(skip)
            .take(input.limit);
          const [tasks, total] = await queryBuilder.getManyAndCount();

          return {
            tasks,
            total,
            totalPages: Math.ceil(total / input.limit),
          };
        }

        const tasks: TaskEntity[] = [];
        const totalsByStatus: number[] = [];

        for (const status of Object.values(TaskStatus)) {
          const count = await this.createListTasksQuery(
            taskRepository,
            input,
            status,
          ).getCount();
          totalsByStatus.push(count);

          if (count <= skip) {
            continue;
          }

          const statusTasks = await this.createListTasksQuery(
            taskRepository,
            input,
            status,
          )
            .orderBy('task.updatedAt', 'DESC')
            .skip(skip)
            .take(input.limit)
            .getMany();
          tasks.push(...statusTasks);
        }

        tasks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

        return {
          tasks,
          total: totalsByStatus.reduce((sum, count) => sum + count, 0),
          totalPages: Math.max(
            0,
            ...totalsByStatus.map((count) => Math.ceil(count / input.limit)),
          ),
        };
      },
    );

    this.logger.log({
      message: 'Tasks listed',
      count: result.tasks.length,
      total: result.total,
      page: input.page,
    });

    return {
      items: result.tasks.map((task) => this.mapTaskToResult(task)),
      total: result.total,
      page: input.page,
      limit: input.limit,
      totalPages: result.totalPages,
    };
  }

  private createListTasksQuery(
    taskRepository: Repository<TaskEntity>,
    input: ListTasksInput,
    status?: TaskStatus,
  ): SelectQueryBuilder<TaskEntity> {
    const queryBuilder = taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.comments', 'comments')
      .leftJoinAndSelect('comments.commenterActor', 'commenterActor')
      .leftJoinAndSelect('task.artefacts', 'artefacts')
      .leftJoinAndSelect('task.inputRequests', 'inputRequests')
      .leftJoinAndSelect('task.tags', 'tags')
      .leftJoinAndSelect('task.dependsOn', 'dependsOn')
      .leftJoinAndSelect('task.assigneeActor', 'assigneeActor')
      .leftJoinAndSelect('task.createdByActor', 'createdByActor');

    if (input.tag) {
      queryBuilder
        .innerJoin('task.tags', 'filterTag')
        .where('filterTag.name = :tagName', { tagName: input.tag });
    }
    if (input.assignee) {
      queryBuilder.andWhere('assigneeActor.slug = :assignee', {
        assignee: input.assignee,
      });
    }
    if (status ?? input.status) {
      queryBuilder.andWhere('task.status = :status', {
        status: status ?? input.status,
      });
    }
    if (input.updatedAfter) {
      queryBuilder.andWhere('task.updatedAt >= :updatedAfter', {
        updatedAfter: input.updatedAfter,
      });
    }
    if (input.sessionId) {
      queryBuilder.andWhere('task.sessionId = :sessionId', {
        sessionId: input.sessionId,
      });
    }

    return queryBuilder;
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

    const commentWithRelations = await this.addTaskCommentUseCase.execute(
      taskId,
      input,
    );

    this.logger.log({
      message: 'Comment added',
      commentId: commentWithRelations.id,
      taskId,
    });

    return this.mapCommentToResult(commentWithRelations);
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

    const artefactWithRelations = await this.addTaskArtefactUseCase.execute(
      taskId,
      input,
      actorId,
    );

    this.logger.log({
      message: 'Artefact added',
      artefactId: artefactWithRelations.id,
      taskId,
    });

    return this.mapArtefactToResult(artefactWithRelations);
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

    const { task: taskWithRelations } =
      await this.changeTaskStatusUseCase.execute(taskId, input, actorId);

    this.logger.log({
      message: 'Task status changed',
      taskId,
      status: taskWithRelations.status,
    });

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

    const taskWithRelations = await this.changeTaskTagUseCase.add(
      taskId,
      input.name,
      actorId,
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

    const taskWithRelations = await this.changeTaskTagUseCase.remove(
      taskId,
      tagId,
      actorId,
    );

    this.logger.log({
      message: 'Tag removed from task',
      taskId,
      tagId,
    });

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

    const savedInputRequest =
      await this.createInputRequestUseCase.execute(input);

    this.logger.log({
      message: 'Input request created',
      inputRequestId: savedInputRequest.id,
      taskId: input.taskId,
      assignedToActorId: savedInputRequest.assignedToActorId,
    });

    return this.mapInputRequestToResult(savedInputRequest);
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

    const updatedInputRequest = await this.answerInputRequestUseCase.execute(
      taskId,
      inputRequestId,
      input,
      actorId,
    );

    this.logger.log({
      message: 'Input request answered',
      inputRequestId,
      taskId,
    });

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
