import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryFailedError, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { ThreadEntity } from './thread.entity';
import { ThreadMessageEntity } from './thread-message.entity';
import { ThreadTaskSubscriptionEntity } from './task-subscriptions/thread-task-subscription.entity';
import { TaskEntity } from '../tasks/task.entity';
import { ContextBlockEntity } from '../context/block.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { MetaService } from '../meta/meta.service';
import { TagEntity } from '../meta/tag.entity';
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
  TaskSubscriptionResult,
  ThreadTimerResult,
  ContextBlockSummaryResult,
  CreateThreadMessageInput,
  ThreadMessageResult,
  ListThreadMessagesInput,
  ListThreadMessagesResult,
} from './dto/service/threads.service.types';
import {
  ThreadNotFoundError,
  TaskNotFoundForThreadError,
  ContextBlockNotFoundError,
  ActorNotFoundForThreadError,
  ParentTaskThreadAlreadyExistsError,
} from './errors/threads.errors';
import {
  MessageCreatedEvent,
  ThreadTitleUpdatedEvent,
  ThreadCreatedEvent,
  ThreadDeletedEvent,
  ThreadUpdatedEvent,
} from './events/threads.events';
import { BlockDeletedEvent } from '../context/events/context.events';
import { ThreadAgentService } from './agent/thread-agent.service';
import { ThreadTitleService } from './thread-title.service';
import { ThreadRenameService } from './thread-rename.service';
import { ThreadReadStateService } from './read-state/thread-read-state.service';
import { ThreadPinsService } from './pins/thread-pins.service';
import { ThreadPinEntity } from './pins/thread-pin.entity';
import { ThreadMessageWriterService } from './thread-message-writer.service';
import { ThreadTimersService } from './timers/thread-timers.service';
import { ThreadWatchesService, ThreadWatchResult } from './watches/thread-watches.service';
import { PullRequestWatchService } from './watches/pull-request-watch.service';
import { PullRequestsService } from '../pull-requests/pull-requests.service';
import { PullRequestEntity } from '../pull-requests/pull-request.entity';
import { IssuesService } from '../issues/issues.service';
import { IssueEntity } from '../issues/issue.entity';
import { ThreadTaskSubscriptionsService } from './task-subscriptions/thread-task-subscriptions.service';

type GenerateTitleFromFirstMessageInput = {
  thread: ThreadEntity;
  actor: ActorEntity;
  messageContent: string;
  existingMessageCount: number;
};

@Injectable()
export class ThreadsService {
  private readonly logger = new Logger(ThreadsService.name);
  private static readonly DEFAULT_THREAD_TITLE = 'New thread';

  private emitThreadUpdated(thread: ThreadEntity): void {
    this.eventEmitter.emit(
      ThreadUpdatedEvent.INTERNAL,
      new ThreadUpdatedEvent({ id: thread.createdByActorId }, thread),
    );
  }

  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    @InjectRepository(ThreadMessageEntity)
    private readonly threadMessageRepository: Repository<ThreadMessageEntity>,
    @InjectRepository(ThreadTaskSubscriptionEntity)
    private readonly taskSubscriptionRepository: Repository<ThreadTaskSubscriptionEntity>,
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
    private readonly eventEmitter: EventEmitter2,
    private readonly threadAgentService: ThreadAgentService,
    private readonly threadTitleService: ThreadTitleService,
    private readonly threadRename: ThreadRenameService,
    private readonly threadReadStateService: ThreadReadStateService,
    private readonly threadPinsService: ThreadPinsService,
    private readonly threadMessageWriter: ThreadMessageWriterService,
    private readonly threadTimers: ThreadTimersService,
    private readonly taskSubscriptions: ThreadTaskSubscriptionsService,
    private readonly threadWatches: ThreadWatchesService,
    private readonly pullRequestWatches: PullRequestWatchService,
    private readonly pullRequests: PullRequestsService,
    private readonly issues: IssuesService,
  ) { }

  /**
   * Threads get their own `workspace_id` in phase 3b. Until then a thread's
   * workspace is the workspace of its state block, which is always created in
   * the caller's workspace. Methods that take `workspaceId` first only see
   * threads (and attach tasks and blocks) in that workspace.
   */
  async createThread(
    workspaceId: string,
    input: CreateThreadInput,
  ): Promise<ThreadResult> {
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

    // Verify parent task exists if provided
    let parentTask: TaskEntity | null = null;
    if (input.parentTaskId) {
      parentTask = await this.taskRepository.findOne({
        where: { workspaceId, id: input.parentTaskId },
      });
      if (!parentTask) {
        throw new TaskNotFoundForThreadError(input.parentTaskId);
      }
    }

    // Resolve every row the thread links to before the first write, so a
    // missing one (or one in another workspace) leaves nothing behind.
    const taskIdsToAttach = new Set(input.taskIds || []);
    if (input.parentTaskId) {
      taskIdsToAttach.add(input.parentTaskId);
    }
    const tasks =
      taskIdsToAttach.size > 0
        ? await this.taskRepository.findBy({
            workspaceId,
            id: In(Array.from(taskIdsToAttach)),
          })
        : [];
    if (tasks.length !== taskIdsToAttach.size) {
      throw new TaskNotFoundForThreadError('One or more tasks not found');
    }
    const blocks =
      input.contextBlockIds && input.contextBlockIds.length > 0
        ? await this.contextBlockRepository.findBy({
            workspaceId,
            id: In(input.contextBlockIds),
          })
        : [];
    if (blocks.length !== (input.contextBlockIds?.length ?? 0)) {
      throw new ContextBlockNotFoundError('One or more blocks not found');
    }
    const participants =
      input.participantActorIds && input.participantActorIds.length > 0
        ? await this.actorRepository.findBy({
            id: In(input.participantActorIds),
          })
        : [];
    if (participants.length !== (input.participantActorIds?.length ?? 0)) {
      throw new ActorNotFoundForThreadError('One or more actors not found');
    }

    // Generate title based on available context
    const title = input.title
      || (parentTask
        ? ((await this.threadTitleService.generateFromParentTask(parentTask, {
            id: createdByActor.id,
            type: createdByActor.type,
          }))
          || ThreadsService.DEFAULT_THREAD_TITLE)
        : ThreadsService.DEFAULT_THREAD_TITLE);

    // Create state context block for the thread
    const stateBlockContent = parentTask
      ? [
          `This thread was created to achieve task ${parentTask.name} (id ${parentTask.id}).`,
          `Parent goal: ${parentTask.description || 'No description provided.'}`,
        ].join('\n')
      : `This thread was created by @${createdByActor.slug}.`;
    const stateBlock = await this.contextService.createBlock(workspaceId, {
      title: `Thread State: ${title}`,
      content: stateBlockContent,
      createdByActorId: input.createdByActorId,
      parentId: null,
      tagNames: ['thread:state'],
    });

    const thread = this.threadRepository.create({
      id: randomUUID(),
      title,
      createdByActorId: input.createdByActorId,
      parentTaskId: input.parentTaskId || null,
      stateContextBlockId: stateBlock.id,
    });

    let savedThread: ThreadEntity;
    try {
      savedThread = await this.threadRepository.save(thread);
    } catch (error) {
      if (this.isParentTaskThreadUniqueViolation(error, input.parentTaskId)) {
        await this.contextBlockRepository.delete({ id: stateBlock.id });
        throw new ParentTaskThreadAlreadyExistsError(input.parentTaskId!);
      }
      throw error;
    }

    // Handle tags if provided
    if (input.tagNames && input.tagNames.length > 0) {
      const tags = await this.metaService.findOrCreateTagEntities(
        workspaceId,
        input.tagNames,
      );
      savedThread.tags = tags;
      await this.threadRepository.save(savedThread);

      // Increment usage tracking for all tags
      await this.metaService.incrementTagsUsage(workspaceId, tags.map((t) => t.id));
    }

    // Tasks (including the parent task), context blocks and participants
    if (tasks.length > 0) {
      savedThread.tasks = tasks;
      await this.threadRepository.save(savedThread);
    }
    if (blocks.length > 0) {
      savedThread.referencedContextBlocks = blocks;
      await this.threadRepository.save(savedThread);
    }
    if (participants.length > 0) {
      savedThread.participants = participants;
      await this.threadRepository.save(savedThread);
    }

    this.eventEmitter.emit(
      ThreadCreatedEvent.INTERNAL,
      new ThreadCreatedEvent({ id: input.createdByActorId }, savedThread),
    );

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
    workspaceId: string,
    threadId: string,
    input: UpdateThreadInput,
    actorId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Updating thread',
      threadId,
    });

    // Scoped lookup before any write: a thread in another workspace is not found.
    await this.getThreadWithRelations(threadId, workspaceId);

    if (input.title !== undefined) {
      await this.threadRename.rename(threadId, input.title, actorId);
    }

    const updatedThread = await this.getThreadWithRelations(threadId, workspaceId);

    this.logger.log({
      message: 'Thread updated',
      threadId,
    });

    return await this.buildThreadResult(updatedThread);
  }

  async deleteThread(
    workspaceId: string,
    threadId: string,
    actorId: string,
  ): Promise<void> {
    this.logger.log({
      message: 'Deleting thread',
      threadId,
      actorId,
    });

    const thread = await this.threadRepository.findOne({
      where: this.threadWhere(threadId, workspaceId),
    });

    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }

    // A real delete, not a soft one: a soft-deleted row kept pointing at its
    // state block (RESTRICT foreign key), so the block could never be deleted
    // and still looked like the state of a thread. Everything that hangs off
    // the thread (messages, links, timers, pins...) goes with it by cascade.
    // The state block belongs to the thread and is deleted with it, unless
    // someone nested blocks under it: then it stays as an ordinary block.
    const stateBlockId = thread.stateContextBlockId;
    const stateBlockDeleted = await this.threadRepository.manager.transaction(
      async (manager) => {
        await manager.delete(ThreadEntity, { id: threadId });

        const hasChildren = await manager.exists(ContextBlockEntity, {
          where: { parentId: stateBlockId },
        });
        if (hasChildren) {
          return false;
        }
        const result = await manager.delete(ContextBlockEntity, { id: stateBlockId });
        return (result.affected ?? 0) > 0;
      },
    );

    this.eventEmitter.emit(
      ThreadDeletedEvent.INTERNAL,
      new ThreadDeletedEvent({ id: actorId }, threadId),
    );
    if (stateBlockDeleted) {
      this.eventEmitter.emit(
        BlockDeletedEvent.INTERNAL,
        new BlockDeletedEvent(
          stateBlockId,
          { id: actorId },
          workspaceId,
        ),
      );
    }

    this.logger.log({
      message: 'Thread deleted',
      threadId,
      stateBlockId,
      stateBlockDeleted,
    });
  }

  /** Cancels a reminder or schedule. Cancelling one that is already gone is harmless. */
  async cancelTimer(threadId: string, timerId: string, actorId: string): Promise<void> {
    await this.assertThreadExists(threadId);
    await this.threadTimers.cancel({ threadId, timerId, actorId });
  }

  /** Stops the agent watching a task. Removing a watch that does not exist is harmless. */
  async removeTaskSubscription(threadId: string, taskId: string, actorId: string): Promise<void> {
    await this.assertThreadExists(threadId);
    await this.taskSubscriptions.unsubscribe({ threadId, taskId, actorId });
  }

  /** Stops the agent watching something. Stopping a watch that does not exist is harmless. */
  async cancelWatch(threadId: string, watchId: string, actorId: string): Promise<void> {
    await this.assertThreadExists(threadId);
    await this.pullRequestWatches.stop({ threadId, watchId, actorId });
  }

  /**
   * Pull requests attached as links to the thread's tasks, oldest link first.
   * Mentions in descriptions, comments and messages are left out.
   */
  async listPullRequests(threadId: string): Promise<PullRequestEntity[]> {
    const thread = await this.threadRepository.findOne({ where: { id: threadId }, relations: ['tasks'] });
    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }
    return this.pullRequests.listLinkedToTasks((thread.tasks ?? []).map((task) => task.id));
  }

  /**
   * Issues attached as links to the thread's tasks, oldest link first.
   * Mentions in descriptions, comments and messages are left out.
   */
  async listIssues(threadId: string): Promise<IssueEntity[]> {
    const thread = await this.threadRepository.findOne({ where: { id: threadId }, relations: ['tasks'] });
    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }
    return this.issues.listLinkedToTasks((thread.tasks ?? []).map((task) => task.id));
  }

  private async assertThreadExists(threadId: string): Promise<void> {
    const exists = await this.threadRepository.exists({ where: { id: threadId } });
    if (!exists) {
      throw new ThreadNotFoundError(threadId);
    }
  }

  /** Not scoped by workspace: for internal listeners until phase 3b. */
  async getThreadById(threadId: string): Promise<ThreadResult> {
    const thread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(thread);
  }

  /** A thread in another workspace answers ThreadNotFound. */
  async getThreadInWorkspace(
    workspaceId: string,
    threadId: string,
  ): Promise<ThreadResult> {
    const thread = await this.getThreadWithRelations(threadId, workspaceId);
    return await this.buildThreadResult(thread);
  }

  async listThreads(input: ListThreadsInput): Promise<ListThreadsResult> {
    this.logger.log({
      message: 'Listing threads',
      page: input.page,
      limit: input.limit,
    });

    const skip = (input.page - 1) * input.limit;

    const query = this.threadRepository.createQueryBuilder('thread');
    if (input.actorId) {
      // The caller's pinned threads come first. At most one pin row matches
      // each thread, so the join never repeats a thread.
      query
        .leftJoin(
          ThreadPinEntity,
          'pin',
          'pin.thread_id = thread.id AND pin.actor_id = :actorId',
          { actorId: input.actorId },
        )
        .orderBy('CASE WHEN pin.thread_id IS NULL THEN 1 ELSE 0 END', 'ASC')
        .addOrderBy('thread.lastActivityAt', 'DESC');
    } else {
      query.orderBy('thread.lastActivityAt', 'DESC');
    }
    // Latest visible message first. The id breaks ties, so a thread never
    // lands on two pages or on none.
    const [threads, total] = await query
      .addOrderBy('thread.id', 'DESC')
      .offset(skip)
      .limit(input.limit)
      .getManyAndCount();

    const threadIds = threads.map((thread) => thread.id);
    const [unreadCounts, pinnedIds] = input.actorId
      ? await Promise.all([
          this.threadReadStateService.getUnreadCounts(threadIds, input.actorId),
          this.threadPinsService.getPinnedThreadIds(threadIds, input.actorId),
        ])
      : [new Map<string, number>(), new Set<string>()];

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
        stateContextBlockId: thread.stateContextBlockId,
        lastActivityAt: thread.lastActivityAt,
        unreadCount: unreadCounts.get(thread.id) ?? 0,
        pinned: pinnedIds.has(thread.id),
      })),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async attachTask(
    workspaceId: string,
    threadId: string,
    taskId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Attaching task to thread',
      threadId,
      taskId,
    });

    const thread = await this.getThreadWithRelations(threadId, workspaceId);
    const task = await this.taskRepository.findOne({
      where: { workspaceId, id: taskId },
    });

    if (!task) {
      throw new TaskNotFoundForThreadError(taskId);
    }

    try {
      await this.threadRepository
        .createQueryBuilder()
        .relation(ThreadEntity, 'tasks')
        .of(threadId)
        .add(taskId);

      this.logger.log({
        message: 'Task attached to thread',
        threadId,
        taskId,
      });
    } catch (error) {
      if (!this.isThreadTaskUniqueViolation(error)) {
        throw error;
      }

      this.logger.log({
        message: 'Task was already attached to thread',
        threadId,
        taskId,
      });
    }

    if (
      task.assigneeActorId &&
      !thread.participants.some(
        (participant) => participant.id === task.assigneeActorId,
      )
    ) {
      await this.addParticipant(threadId, task.assigneeActorId);
    }

    const updatedThread = await this.getThreadWithRelations(threadId);
    this.emitThreadUpdated(updatedThread);
    return await this.buildThreadResult(updatedThread);
  }

  async detachTask(
    workspaceId: string,
    threadId: string,
    taskId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Detaching task from thread',
      threadId,
      taskId,
    });

    const thread = await this.getThreadWithRelations(threadId, workspaceId);
    thread.tasks = thread.tasks.filter((task) => task.id !== taskId);
    await this.threadRepository.save(thread);

    this.logger.log({
      message: 'Task detached from thread',
      threadId,
      taskId,
    });

    const updatedThread = await this.getThreadWithRelations(threadId);
    this.emitThreadUpdated(updatedThread);
    return await this.buildThreadResult(updatedThread);
  }

  async referenceContextBlock(
    workspaceId: string,
    threadId: string,
    contextBlockId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Referencing context block in thread',
      threadId,
      contextBlockId,
    });

    const thread = await this.getThreadWithRelations(threadId, workspaceId);
    const block = await this.contextBlockRepository.findOne({
      where: { workspaceId, id: contextBlockId },
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
    this.emitThreadUpdated(updatedThread);
    return await this.buildThreadResult(updatedThread);
  }

  async unreferenceContextBlock(
    workspaceId: string,
    threadId: string,
    contextBlockId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Removing referenced context block from thread',
      threadId,
      contextBlockId,
    });

    const thread = await this.getThreadWithRelations(threadId, workspaceId);
    thread.referencedContextBlocks = thread.referencedContextBlocks.filter(
      (block) => block.id !== contextBlockId,
    );
    await this.threadRepository.save(thread);

    this.logger.log({
      message: 'Referenced context block removed from thread',
      threadId,
      contextBlockId,
    });

    const updatedThread = await this.getThreadWithRelations(threadId);
    this.emitThreadUpdated(updatedThread);
    return await this.buildThreadResult(updatedThread);
  }

  async addTagToThread(
    workspaceId: string,
    threadId: string,
    input: AddTagInput,
    actorId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Adding tag to thread',
      threadId,
      tagName: input.name,
    });

    const thread = await this.getThreadWithRelations(threadId, workspaceId);
    const tag = await this.metaService.findOrCreateTagEntity(workspaceId, input.name);

    // Add tag if not already present
    if (!thread.tags.some((t) => t.id === tag.id)) {
      thread.tags.push(tag);
      await this.threadRepository.save(thread);

      // Increment tag usage tracking
      await this.metaService.incrementTagUsage(workspaceId, tag.id);

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
    workspaceId: string,
    threadId: string,
    tagId: string,
    actorId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Removing tag from thread',
      threadId,
      tagId,
    });

    const thread = await this.getThreadWithRelations(threadId, workspaceId);
    thread.tags = thread.tags.filter((tag) => tag.id !== tagId);
    await this.threadRepository.save(thread);

    this.logger.log({
      message: 'Tag removed from thread',
      threadId,
      tagId,
    });

    // Check if tag is now orphaned and clean it up
    await this.metaService.cleanupOrphanedTag(workspaceId, tagId);

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

    if (!thread.participants.some((p) => p.id === actorId)) {
      try {
        await this.threadRepository
          .createQueryBuilder()
          .relation(ThreadEntity, 'participants')
          .of(threadId)
          .add(actorId);
      } catch (error) {
        if (!this.isThreadParticipantUniqueViolation(error)) {
          throw error;
        }
      }

      this.logger.log({
        message: 'Participant added to thread',
        threadId,
        actorId,
      });
    }

    const updatedThread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(updatedThread);
  }

  /** Not scoped by workspace: for internal listeners until phase 3b. */
  async findThreadByTaskId(taskId: string): Promise<ThreadResult | null> {
    return this.queryThreadByTaskId(taskId);
  }

  /** A task in another workspace answers null, like a task with no thread. */
  async findThreadByTaskIdInWorkspace(
    workspaceId: string,
    taskId: string,
  ): Promise<ThreadResult | null> {
    return this.queryThreadByTaskId(taskId, workspaceId);
  }

  private async queryThreadByTaskId(
    taskId: string,
    workspaceId?: string,
  ): Promise<ThreadResult | null> {
    this.logger.log({
      message: 'Finding thread by task ID',
      taskId,
    });

    const query = this.threadRepository
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
      .where('filterTask.id = :taskId', { taskId });
    if (workspaceId) {
      query
        .innerJoin('thread.stateContextBlock', 'stateBlock')
        .andWhere('filterTask.workspaceId = :workspaceId', { workspaceId })
        .andWhere('stateBlock.workspaceId = :workspaceId', { workspaceId });
    }
    const thread = await query.getOne();

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

    return Promise.all(threads.map((thread) => this.buildThreadResult(thread)));
  }

  async findThreadByParentTaskId(
    parentTaskId: string,
  ): Promise<ThreadResult | null> {
    this.logger.log({
      message: 'Finding thread by parent task ID',
      parentTaskId,
    });

    const thread = await this.threadRepository.findOne({
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

    if (!thread) {
      return null;
    }

    return this.buildThreadResult(thread);
  }

  async findThreadsByStateBlockId(
    workspaceId: string,
    stateBlockId: string,
  ): Promise<ThreadResult[]> {
    this.logger.log({
      message: 'Finding threads by state block ID',
      stateBlockId,
    });

    const threads = await this.threadRepository.find({
      where: {
        stateContextBlockId: stateBlockId,
        stateContextBlock: { workspaceId },
      },
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

    return Promise.all(threads.map((thread) => this.buildThreadResult(thread)));
  }

  async getThreadState(workspaceId: string, threadId: string): Promise<string> {
    this.logger.log({
      message: 'Getting thread state',
      threadId,
    });

    const thread = await this.threadRepository.findOne({
      where: this.threadWhere(threadId, workspaceId),
    });

    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }

    const stateBlock = await this.contextService.getBlockById(
      workspaceId,
      thread.stateContextBlockId,
    );

    return stateBlock.content;
  }

  async updateThreadState(
    workspaceId: string,
    threadId: string,
    content: string,
  ): Promise<string> {
    this.logger.log({
      message: 'Updating thread state',
      threadId,
    });

    const thread = await this.threadRepository.findOne({
      where: this.threadWhere(threadId, workspaceId),
    });

    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }

    const updatedBlock = await this.contextService.updateBlock(
      workspaceId,
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

  async appendThreadState(
    workspaceId: string,
    threadId: string,
    content: string,
  ): Promise<string> {
    this.logger.log({
      message: 'Appending to thread state',
      threadId,
    });

    const thread = await this.threadRepository.findOne({
      where: this.threadWhere(threadId, workspaceId),
    });

    if (!thread) {
      throw new ThreadNotFoundError(threadId);
    }

    const updatedBlock = await this.contextService.appendToBlock(
      workspaceId,
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

  /**
   * With a workspace, a thread whose state block is in another workspace is
   * not found. See createThread.
   */
  private threadWhere(
    threadId: string,
    workspaceId?: string,
  ): FindOptionsWhere<ThreadEntity> {
    return workspaceId
      ? { id: threadId, stateContextBlock: { workspaceId } }
      : { id: threadId };
  }

  private async getThreadWithRelations(
    threadId: string,
    workspaceId?: string,
  ): Promise<ThreadEntity> {
    const thread = await this.threadRepository.findOne({
      where: this.threadWhere(threadId, workspaceId),
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

  private isPlaceholderTitle(title: string | null | undefined): boolean {
    if (!title) {
      return true;
    }

    return title.trim().toLowerCase() === ThreadsService.DEFAULT_THREAD_TITLE.toLowerCase();
  }

  private async maybeGenerateTitleFromFirstMessage(
    input: GenerateTitleFromFirstMessageInput,
  ): Promise<void> {
    if (input.existingMessageCount > 0) {
      return;
    }
    if (!this.isPlaceholderTitle(input.thread.title)) {
      return;
    }

    const content = input.messageContent.trim();
    if (!content) {
      return;
    }

    // A person's message is named on user small tasks, an agent's on system small tasks.
    const generatedTitle = await this.threadTitleService.generateFromMessage(content, {
      id: input.actor.id,
      type: input.actor.type,
    });
    if (!generatedTitle || this.isPlaceholderTitle(generatedTitle)) {
      return;
    }

    input.thread.title = generatedTitle;
    await this.threadRepository.save(input.thread);
    this.eventEmitter.emit(
      ThreadTitleUpdatedEvent.INTERNAL,
      new ThreadTitleUpdatedEvent(
        { id: input.actor.id },
        {
          threadId: input.thread.id,
          title: generatedTitle,
        },
      ),
    );

    try {
      const stateBlock = await this.contextBlockRepository.findOneOrFail({
        where: { id: input.thread.stateContextBlockId },
        select: { id: true, workspaceId: true },
      });
      await this.contextService.updateBlock(stateBlock.workspaceId, stateBlock.id, {
        title: `Thread State: ${generatedTitle}`,
      });
    } catch (error) {
      this.logger.warn({
        message: 'Failed to update thread state block title after generating thread title',
        threadId: input.thread.id,
        stateContextBlockId: input.thread.stateContextBlockId,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      });
    }
  }

  private async buildThreadResult(thread: ThreadEntity): Promise<ThreadResult> {
    const [taskSubscriptions, timers, watches] = await Promise.all([
      this.loadTaskSubscriptions(thread.id),
      this.threadTimers.listActive(thread.id),
      this.threadWatches.listForThread(thread.id),
    ]);
    return this.mapThreadToResult(thread, taskSubscriptions, timers, watches);
  }

  private mapThreadToResult(
    thread: ThreadEntity,
    taskSubscriptions: TaskSubscriptionResult[],
    timers: ThreadTimerResult[],
    watches: ThreadWatchResult[],
  ): ThreadResult {
    if (!thread.createdByActor) {
      throw new Error(`Thread ${thread.id} is missing createdByActor relation`);
    }

    return {
      id: thread.id,
      title: thread.title,
      createdByActor: this.mapActorToResult(thread.createdByActor),
      parentTaskId: thread.parentTaskId || null,
      stateContextBlockId: thread.stateContextBlockId,
      tasks: (thread.tasks || []).map((task) => this.mapTaskToSummary(task)),
      referencedContextBlocks: (thread.referencedContextBlocks || []).map(
        (block) => this.mapContextBlockToSummary(block),
      ),
      tags: (thread.tags || []).map((tag) => this.mapTagToResult(tag)),
      participants: (thread.participants || []).map((actor) =>
        this.mapActorToResult(actor),
      ),
      taskSubscriptions,
      timers,
      watches,
      rowVersion: thread.rowVersion,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  /**
   * Oldest first. Loaded on its own rather than as a thread relation, so saving
   * a thread never touches subscriptions made while it was loaded.
   */
  private async loadTaskSubscriptions(threadId: string): Promise<TaskSubscriptionResult[]> {
    const subscriptions = await this.taskSubscriptionRepository.find({
      where: { threadId },
      relations: ['task'],
      order: { createdAt: 'ASC' },
    });

    // A subscription whose task was deleted is not shown.
    return subscriptions
      .filter((subscription) => subscription.task)
      .map((subscription) => ({
        taskId: subscription.taskId,
        name: subscription.task!.name,
        status: subscription.task!.status,
        createdAt: subscription.createdAt,
      }));
  }

  private isParentTaskThreadUniqueViolation(
    error: unknown,
    parentTaskId?: string,
  ): boolean {
    if (!parentTaskId || !(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = (error as any).driverError;
    const code = driverError?.code;
    const message = driverError?.message ?? '';

    const isUniqueConstraintCode =
      code === 'SQLITE_CONSTRAINT' || code === '23505';
    if (!isUniqueConstraintCode) {
      return false;
    }

    return (
      message.includes('uq_threads_parent_task_id_non_null')
      || message.includes('threads.parent_task_id')
    );
  }

  private isThreadTaskUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = (error as any).driverError;
    const code = driverError?.code;
    const message = driverError?.message ?? '';

    const isUniqueConstraintCode =
      code === 'SQLITE_CONSTRAINT' || code === '23505';
    if (!isUniqueConstraintCode) {
      return false;
    }

    return (
      message.includes('thread_tasks')
      && message.includes('thread_id')
      && message.includes('task_id')
    );
  }

  private isThreadParticipantUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = (error as any).driverError;
    const code = driverError?.code;
    const message = driverError?.message ?? '';

    const isUniqueConstraintCode =
      code === 'SQLITE_CONSTRAINT' || code === '23505';
    if (!isUniqueConstraintCode) {
      return false;
    }

    return (
      message.includes('thread_participants')
      && message.includes('thread_id')
      && message.includes('actor_id')
    );
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

  // Thread message methods
  async createMessage(
    input: CreateThreadMessageInput,
  ): Promise<ThreadMessageResult> {
    this.logger.log({
      message: 'Creating thread message',
      threadId: input.threadId,
    });

    // Verify thread exists
    const thread = await this.threadRepository.findOne({
      where: { id: input.threadId },
    });
    if (!thread) {
      throw new ThreadNotFoundError(input.threadId);
    }

    // Verify actor exists if provided
    const actor = await this.actorRepository.findOne({
      where: { id: input.createdByActorId },
    });
    if (!actor) {
      throw new ActorNotFoundForThreadError(input.createdByActorId);
    }
    const existingMessageCount = await this.threadMessageRepository.count({
      where: { threadId: input.threadId },
    });

    const messageWithRelations = await this.threadMessageWriter.write({
      threadId: input.threadId,
      content: input.content,
      createdByActorId: input.createdByActorId,
      timezone: input.timezone ?? null,
    });

    this.logger.log({
      message: 'Thread message created',
      messageId: messageWithRelations.id,
      threadId: input.threadId,
    });

    // Emit domain event
    this.eventEmitter.emit(
      MessageCreatedEvent.INTERNAL,
      new MessageCreatedEvent(
        { id: input.createdByActorId },
        messageWithRelations,
      ),
    );

    // The agent answers in the background; any backend process may pick the turn up.
    this.threadAgentService.requestTurn(thread.id);

    await this.maybeGenerateTitleFromFirstMessage({
      thread,
      actor,
      messageContent: input.content,
      existingMessageCount,
    });

    return this.mapThreadMessageToResult(messageWithRelations);
  }

  async listMessages(
    input: ListThreadMessagesInput,
  ): Promise<ListThreadMessagesResult> {
    this.logger.log({
      message: 'Listing thread messages',
      threadId: input.threadId,
      page: input.page,
      limit: input.limit,
    });

    // Verify thread exists
    const thread = await this.threadRepository.findOne({
      where: { id: input.threadId },
    });
    if (!thread) {
      throw new ThreadNotFoundError(input.threadId);
    }

    const skip = (input.page - 1) * input.limit;

    const [messages, total] = await this.threadMessageRepository.findAndCount({
      where: { threadId: input.threadId },
      relations: ['createdByActor'],
      // Newest first, so page 1 is always the latest messages however long
      // the thread gets. The id breaks ties so pages never overlap or skip.
      order: { createdAt: 'DESC', id: 'DESC' },
      skip,
      take: input.limit,
    });

    this.logger.log({
      message: 'Thread messages listed',
      threadId: input.threadId,
      count: messages.length,
      total,
    });

    return {
      items: messages.map((msg) => this.mapThreadMessageToResult(msg)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  private mapThreadMessageToResult(
    message: ThreadMessageEntity,
  ): ThreadMessageResult {
    return {
      id: message.id,
      threadId: message.threadId,
      content: message.content,
      createdByActorId: message.createdByActorId,
      createdByActor: message.createdByActor
        ? this.mapActorToResult(message.createdByActor)
        : null,
      createdAt: message.createdAt,
    };
  }
}
