import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ThreadEntity } from './thread.entity';
import { TaskEntity } from '../tasks/task.entity';
import { ContextBlockEntity } from '../context/block.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { MetaService } from '../meta/meta.service';
import { ContextService } from '../context/context.service';
import {
  CreateThreadInput,
  UpdateThreadInput,
  AddTagInput,
  ListThreadsInput,
  ThreadResult,
  ListThreadsResult,
  ActorResult,
  TagResult,
  TaskSummaryResult,
  ContextBlockSummaryResult,
} from './dto/service/threads.service.types';
import {
  ThreadNotFoundError,
  TaskNotFoundForThreadError,
  ContextBlockNotFoundError,
  ActorNotFoundForThreadError,
} from './errors/threads.errors';

@Injectable()
export class ThreadsService {
  private readonly logger = new Logger(ThreadsService.name);

  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(ContextBlockEntity)
    private readonly contextBlockRepository: Repository<ContextBlockEntity>,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
    @InjectRepository(AgentRunEntity)
    private readonly agentRunRepository: Repository<AgentRunEntity>,
    private readonly metaService: MetaService,
    private readonly contextService: ContextService,
  ) {}

  async createThread(input: CreateThreadInput): Promise<ThreadResult> {
    this.logger.log({
      message: 'Creating thread',
      createdByActorId: input.createdByActorId,
      parentTaskId: input.parentTaskId,
    });

    // Verify creator exists
    const createdByActor = await this.actorRepository.findOne({
      where: { id: input.createdByActorId },
    });
    if (!createdByActor) {
      throw new ActorNotFoundForThreadError(input.createdByActorId);
    }

    // Verify parent task exists
    const parentTask = await this.taskRepository.findOne({
      where: { id: input.parentTaskId },
    });
    if (!parentTask) {
      throw new TaskNotFoundForThreadError(input.parentTaskId);
    }

    // Generate title if not provided
    const title = input.title || this.inferTitle(createdByActor.slug);

    // Create state context block for the thread
    const stateBlockContent = `This thread was created to achieve task ${parentTask.name} (id ${parentTask.id}).`;
    const stateBlock = await this.contextService.createBlock({
      title: `Thread State: ${title}`,
      content: stateBlockContent,
      createdByActorId: input.createdByActorId,
      parentId: null,
      tagNames: ['thread:state'],
    });

    const thread = this.threadRepository.create({
      title,
      createdByActorId: input.createdByActorId,
      parentTaskId: input.parentTaskId,
      stateContextBlockId: stateBlock.id,
    });

    const savedThread = await this.threadRepository.save(thread);

    // Handle tags if provided
    if (input.tagNames && input.tagNames.length > 0) {
      const tags = await this.metaService.findOrCreateTagEntities(
        input.tagNames,
      );
      savedThread.tags = tags;
      await this.threadRepository.save(savedThread);
    }

    // Handle tasks if provided
    // Always include parent task in the tasks relation
    const taskIdsToAttach = new Set(input.taskIds || []);
    taskIdsToAttach.add(input.parentTaskId);

    if (taskIdsToAttach.size > 0) {
      const tasks = await this.taskRepository.findBy({
        id: In(Array.from(taskIdsToAttach)),
      });
      if (tasks.length !== taskIdsToAttach.size) {
        throw new TaskNotFoundForThreadError('One or more tasks not found');
      }
      savedThread.tasks = tasks;
      await this.threadRepository.save(savedThread);
    }

    // Handle context blocks if provided
    if (input.contextBlockIds && input.contextBlockIds.length > 0) {
      const blocks = await this.contextBlockRepository.findBy({
        id: In(input.contextBlockIds),
      });
      if (blocks.length !== input.contextBlockIds.length) {
        throw new ContextBlockNotFoundError('One or more blocks not found');
      }
      savedThread.referencedContextBlocks = blocks;
      await this.threadRepository.save(savedThread);
    }

    // Handle participants if provided
    if (input.participantActorIds && input.participantActorIds.length > 0) {
      const participants = await this.actorRepository.findBy({
        id: In(input.participantActorIds),
      });
      if (participants.length !== input.participantActorIds.length) {
        throw new ActorNotFoundForThreadError('One or more actors not found');
      }
      savedThread.participants = participants;
      await this.threadRepository.save(savedThread);
    }

    // Reload with relations
    const threadWithRelations = await this.getThreadWithRelations(
      savedThread.id,
    );

    this.logger.log({
      message: 'Thread created',
      threadId: threadWithRelations.id,
      title: threadWithRelations.title,
    });

    return await this.buildThreadResult(threadWithRelations);
  }

  async updateThread(
    threadId: string,
    input: UpdateThreadInput,
    actorId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Updating thread',
      threadId,
    });

    const thread = await this.getThreadWithRelations(threadId);

    if (input.title !== undefined) {
      thread.title = input.title;
    }

    await this.threadRepository.save(thread);

    const updatedThread = await this.getThreadWithRelations(threadId);

    this.logger.log({
      message: 'Thread updated',
      threadId,
    });

    return await this.buildThreadResult(updatedThread);
  }

  async deleteThread(threadId: string, actorId: string): Promise<void> {
    this.logger.log({
      message: 'Deleting thread',
      threadId,
      actorId,
    });

    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
    });

    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }

    await this.threadRepository.softRemove(thread);

    this.logger.log({
      message: 'Thread deleted',
      threadId,
    });
  }

  async getThreadById(threadId: string): Promise<ThreadResult> {
    const thread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(thread);
  }

  async listThreads(input: ListThreadsInput): Promise<ListThreadsResult> {
    this.logger.log({
      message: 'Listing threads',
      page: input.page,
      limit: input.limit,
    });

    const skip = (input.page - 1) * input.limit;

    const [threads, total] = await this.threadRepository.findAndCount({
      skip,
      take: input.limit,
      order: { updatedAt: 'DESC' },
    });

    this.logger.log({
      message: 'Threads listed',
      count: threads.length,
      total,
      page: input.page,
    });

    return {
      items: threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
      })),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async attachTask(threadId: string, taskId: string): Promise<ThreadResult> {
    this.logger.log({
      message: 'Attaching task to thread',
      threadId,
      taskId,
    });

    const thread = await this.getThreadWithRelations(threadId);
    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new TaskNotFoundForThreadError(taskId);
    }

    // Check if task is already attached
    if (!thread.tasks.some((t) => t.id === taskId)) {
      thread.tasks.push(task);
      await this.threadRepository.save(thread);
      this.logger.log({
        message: 'Task attached to thread',
        threadId,
        taskId,
      });
    }

    const updatedThread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(updatedThread);
  }

  async referenceContextBlock(
    threadId: string,
    contextBlockId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Referencing context block in thread',
      threadId,
      contextBlockId,
    });

    const thread = await this.getThreadWithRelations(threadId);
    const block = await this.contextBlockRepository.findOne({
      where: { id: contextBlockId },
    });

    if (!block) {
      throw new ContextBlockNotFoundError(contextBlockId);
    }

    // Check if block is already referenced
    if (!thread.referencedContextBlocks.some((b) => b.id === contextBlockId)) {
      thread.referencedContextBlocks.push(block);
      await this.threadRepository.save(thread);
      this.logger.log({
        message: 'Context block referenced in thread',
        threadId,
        contextBlockId,
      });
    }

    const updatedThread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(updatedThread);
  }

  async addTagToThread(
    threadId: string,
    input: AddTagInput,
    actorId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Adding tag to thread',
      threadId,
      tagName: input.name,
    });

    const thread = await this.getThreadWithRelations(threadId);
    const tag = await this.metaService.findOrCreateTagEntity(input.name);

    // Add tag if not already present
    if (!thread.tags.some((t) => t.id === tag.id)) {
      thread.tags.push(tag);
      await this.threadRepository.save(thread);
      this.logger.log({
        message: 'Tag added to thread',
        threadId,
        tagId: tag.id,
      });
    }

    const updatedThread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(updatedThread);
  }

  async removeTagFromThread(
    threadId: string,
    tagId: string,
    actorId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Removing tag from thread',
      threadId,
      tagId,
    });

    const thread = await this.getThreadWithRelations(threadId);
    thread.tags = thread.tags.filter((tag) => tag.id !== tagId);
    await this.threadRepository.save(thread);

    this.logger.log({
      message: 'Tag removed from thread',
      threadId,
      tagId,
    });

    // Check if tag is now orphaned and clean it up
    await this.metaService.cleanupOrphanedTag(tagId);

    const updatedThread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(updatedThread);
  }

  async addParticipant(
    threadId: string,
    actorId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Adding participant to thread',
      threadId,
      actorId,
    });

    const thread = await this.getThreadWithRelations(threadId);
    const actor = await this.actorRepository.findOne({
      where: { id: actorId },
    });

    if (!actor) {
      throw new ActorNotFoundForThreadError(actorId);
    }

    // Add participant if not already present
    if (!thread.participants.some((p) => p.id === actorId)) {
      thread.participants.push(actor);
      await this.threadRepository.save(thread);
      this.logger.log({
        message: 'Participant added to thread',
        threadId,
        actorId,
      });
    }

    const updatedThread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(updatedThread);
  }

  async findThreadByTaskId(taskId: string): Promise<ThreadResult | null> {
    this.logger.log({
      message: 'Finding thread by task ID',
      taskId,
    });

    const thread = await this.threadRepository
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.createdByActor', 'createdByActor')
      .leftJoinAndSelect('thread.tasks', 'tasks')
      .leftJoinAndSelect('tasks.assigneeActor', 'taskAssigneeActor')
      .leftJoinAndSelect('tasks.createdByActor', 'taskCreatedByActor')
      .leftJoinAndSelect('tasks.tags', 'taskTags')
      .leftJoinAndSelect('tasks.comments', 'taskComments')
      .leftJoinAndSelect('tasks.inputRequests', 'taskInputRequests')
      .leftJoinAndSelect('thread.referencedContextBlocks', 'referencedContextBlocks')
      .leftJoinAndSelect('thread.tags', 'tags')
      .leftJoinAndSelect('thread.participants', 'participants')
      .innerJoin('thread.tasks', 'filterTask')
      .where('filterTask.id = :taskId', { taskId })
      .getOne();

    if (!thread) {
      return null;
    }

    return await this.buildThreadResult(thread);
  }

  async findThreadsByParentTaskId(parentTaskId: string): Promise<ThreadResult[]> {
    this.logger.log({
      message: 'Finding threads by parent task ID',
      parentTaskId,
    });

    const threads = await this.threadRepository.find({
      where: { parentTaskId },
      relations: [
        'createdByActor',
        'tasks',
        'tasks.assigneeActor',
        'tasks.createdByActor',
        'tasks.tags',
        'tasks.comments',
        'tasks.inputRequests',
        'referencedContextBlocks',
        'tags',
        'participants',
      ],
    });

    return threads.map((thread) => this.mapThreadToResult(thread));
  }

  async findThreadsByStateBlockId(stateBlockId: string): Promise<ThreadResult[]> {
    this.logger.log({
      message: 'Finding threads by state block ID',
      stateBlockId,
    });

    const threads = await this.threadRepository.find({
      where: { stateContextBlockId: stateBlockId },
      relations: [
        'createdByActor',
        'tasks',
        'tasks.assigneeActor',
        'tasks.createdByActor',
        'tasks.tags',
        'tasks.comments',
        'tasks.inputRequests',
        'referencedContextBlocks',
        'tags',
        'participants',
      ],
      withDeleted: true, // Include soft-deleted threads because FK constraint still applies
    });

    return threads.map((thread) => this.mapThreadToResult(thread));
  }

  async getThreadState(threadId: string): Promise<string> {
    this.logger.log({
      message: 'Getting thread state',
      threadId,
    });

    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
    });

    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }

    const stateBlock = await this.contextService.getBlockById(
      thread.stateContextBlockId,
    );

    return stateBlock.content;
  }

  async updateThreadState(threadId: string, content: string): Promise<string> {
    this.logger.log({
      message: 'Updating thread state',
      threadId,
    });

    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
    });

    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }

    const updatedBlock = await this.contextService.updateBlock(
      thread.stateContextBlockId,
      {
        content,
      },
    );

    this.logger.log({
      message: 'Thread state updated',
      threadId,
    });

    return updatedBlock.content;
  }

  async appendThreadState(threadId: string, content: string): Promise<string> {
    this.logger.log({
      message: 'Appending to thread state',
      threadId,
    });

    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
    });

    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }

    const updatedBlock = await this.contextService.appendToBlock(
      thread.stateContextBlockId,
      {
        content,
      },
    );

    this.logger.log({
      message: 'Thread state appended',
      threadId,
    });

    return updatedBlock.content;
  }

  private async getThreadWithRelations(threadId: string): Promise<ThreadEntity> {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
      relations: [
        'createdByActor',
        'tasks',
        'tasks.assigneeActor',
        'tasks.createdByActor',
        'tasks.tags',
        'tasks.comments',
        'tasks.inputRequests',
        'referencedContextBlocks',
        'tags',
        'participants',
      ],
    });

    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }

    return thread;
  }

  private inferTitle(actorSlug: string): string {
    return `@${actorSlug} created`;
  }

  private async buildThreadResult(thread: ThreadEntity): Promise<ThreadResult> {
    return this.mapThreadToResult(thread);
  }

  private mapThreadToResult(thread: ThreadEntity): ThreadResult {
    if (!thread.createdByActor) {
      throw new Error(`Thread ${thread.id} is missing createdByActor relation`);
    }

    return {
      id: thread.id,
      title: thread.title,
      createdByActor: this.mapActorToResult(thread.createdByActor),
      parentTaskId: thread.parentTaskId,
      stateContextBlockId: thread.stateContextBlockId,
      tasks: (thread.tasks || []).map((task) => this.mapTaskToSummary(task)),
      referencedContextBlocks: (thread.referencedContextBlocks || []).map(
        (block) => this.mapContextBlockToSummary(block),
      ),
      tags: (thread.tags || []).map((tag) => this.mapTagToResult(tag)),
      participants: (thread.participants || []).map((actor) =>
        this.mapActorToResult(actor),
      ),
      rowVersion: thread.rowVersion,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      deletedAt: thread.deletedAt,
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

  private mapTagToResult(tag: any): TagResult {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }

  private mapTaskToSummary(task: TaskEntity): TaskSummaryResult {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      assigneeActor: task.assigneeActor
        ? this.mapActorToResult(task.assigneeActor)
        : null,
      createdByActor: task.createdByActor
        ? this.mapActorToResult(task.createdByActor)
        : ({} as ActorResult), // Should always be present
      tags: (task.tags || []).map((tag) => this.mapTagToResult(tag)),
      commentCount: task.comments?.length || 0,
      inputRequests: task.inputRequests || [],
      updatedAt: task.updatedAt,
    };
  }

  private mapContextBlockToSummary(
    block: ContextBlockEntity,
  ): ContextBlockSummaryResult {
    return {
      id: block.id,
      title: block.title,
    };
  }
}
