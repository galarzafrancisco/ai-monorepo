import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { ThreadEntity } from './thread.entity';
import { ThreadMessageEntity } from './thread-message.entity';
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
  ContextBlockSummaryResult,
  CreateThreadMessageInput,
  ThreadMessageResult,
  ListThreadMessagesInput,
  ListThreadMessagesResult,
} from './dto/service/threads.service.types';
import {
  ThreadNotFoundError,
  ActorNotFoundForThreadError,
} from './errors/threads.errors';
import {
  MessageCreatedEvent,
  ThreadAgentActivityEvent,
  ThreadAgentActivityKind,
  ThreadAgentResponseDeltaEvent,
} from './events/threads.events';
import { ChatService } from './chat.service';
import { ChatStreamEvent } from './backends/chat-backend.interface';
import { NoActiveChatProviderError } from '../chat-providers/errors/chat-providers.errors';
import { ActorType } from '../identity-provider/enums';
import { ThreadTitleWorkflowService } from './thread-title-workflow.service';
import { UpdateThreadUseCase } from './use-cases/update-thread.use-case';
import { DeleteThreadUseCase } from './use-cases/delete-thread.use-case';
import { CreateThreadUseCase } from './use-cases/create-thread.use-case';
import { ChangeThreadTagUseCase } from './use-cases/change-thread-tag.use-case';
import { ChangeThreadTaskUseCase } from './use-cases/change-thread-task.use-case';
import { ChangeThreadRelationsUseCase } from './use-cases/change-thread-relations.use-case';
import { CreateThreadMessageUseCase } from './use-cases/create-thread-message.use-case';

type GenerateTitleFromFirstMessageInput = {
  thread: ThreadEntity;
  actor: ActorEntity;
  messageContent: string;
  existingMessageCount: number;
};

type EmitAgentActivityInput = {
  threadId: string;
  actorId: string;
  kind: ThreadAgentActivityKind;
};

type EmitAgentResponseDeltaInput = {
  threadId: string;
  actorId: string;
  streamId: string;
  delta: string;
};

@Injectable()
export class ThreadsService {
  private readonly logger = new Logger(ThreadsService.name);
  private static readonly DEFAULT_THREAD_TITLE = 'New thread';

  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    @InjectRepository(ThreadMessageEntity)
    private readonly threadMessageRepository: Repository<ThreadMessageEntity>,
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
    private readonly chatService: ChatService,
    private readonly threadTitleWorkflow: ThreadTitleWorkflowService,
    private readonly updateThreadUseCase: UpdateThreadUseCase,
    private readonly deleteThreadUseCase: DeleteThreadUseCase,
    private readonly createThreadUseCase: CreateThreadUseCase,
    private readonly changeThreadTagUseCase: ChangeThreadTagUseCase,
    private readonly changeThreadTaskUseCase: ChangeThreadTaskUseCase,
    private readonly changeThreadRelationsUseCase: ChangeThreadRelationsUseCase,
    private readonly createThreadMessageUseCase: CreateThreadMessageUseCase,
  ) {}

  private async ensureThreadConversationSession(
    thread: ThreadEntity,
  ): Promise<ThreadEntity> {
    if (thread.chatSessionId) {
      return thread;
    }

    this.logger.warn({
      message: 'Thread missing chat session id, recreating conversation',
      threadId: thread.id,
    });

    const conversation = await this.chatService.createConversation({
      threadId: thread.id,
    });

    thread.chatSessionId = conversation.id;

    return await this.threadRepository.save(thread);
  }

  async createThread(input: CreateThreadInput): Promise<ThreadResult> {
    this.logger.log({
      message: 'Creating thread',
      createdByActorId: input.createdByActorId,
      parentTaskId: input.parentTaskId,
    });

    const savedThread = await this.createThreadUseCase.execute(input);
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

    await this.updateThreadUseCase.execute(threadId, input, actorId);

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

    await this.deleteThreadUseCase.execute(threadId, actorId);

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
        chatSessionId: thread.chatSessionId ?? null,
        stateContextBlockId: thread.stateContextBlockId,
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

    await this.changeThreadTaskUseCase.attach(threadId, taskId);

    const updatedThread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(updatedThread);
  }

  async detachTask(threadId: string, taskId: string): Promise<ThreadResult> {
    this.logger.log({
      message: 'Detaching task from thread',
      threadId,
      taskId,
    });

    await this.changeThreadTaskUseCase.detach(threadId, taskId);

    this.logger.log({
      message: 'Task detached from thread',
      threadId,
      taskId,
    });

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

    await this.changeThreadRelationsUseCase.referenceContextBlock(
      threadId,
      contextBlockId,
    );

    const updatedThread = await this.getThreadWithRelations(threadId);
    return await this.buildThreadResult(updatedThread);
  }

  async unreferenceContextBlock(
    threadId: string,
    contextBlockId: string,
  ): Promise<ThreadResult> {
    this.logger.log({
      message: 'Removing referenced context block from thread',
      threadId,
      contextBlockId,
    });

    await this.changeThreadRelationsUseCase.unreferenceContextBlock(
      threadId,
      contextBlockId,
    );

    this.logger.log({
      message: 'Referenced context block removed from thread',
      threadId,
      contextBlockId,
    });

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

    await this.changeThreadTagUseCase.add(threadId, input.name, actorId);

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

    await this.changeThreadTagUseCase.remove(threadId, tagId, actorId);

    this.logger.log({
      message: 'Tag removed from thread',
      threadId,
      tagId,
    });

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

    await this.changeThreadRelationsUseCase.addParticipant(threadId, actorId);

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
      .leftJoinAndSelect(
        'thread.referencedContextBlocks',
        'referencedContextBlocks',
      )
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

  async findThreadsByParentTaskId(
    parentTaskId: string,
  ): Promise<ThreadResult[]> {
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

    return this.mapThreadToResult(thread);
  }

  async findThreadsByStateBlockId(
    stateBlockId: string,
  ): Promise<ThreadResult[]> {
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

  private async getThreadWithRelations(
    threadId: string,
  ): Promise<ThreadEntity> {
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

  private isPlaceholderTitle(title: string | null | undefined): boolean {
    if (!title) {
      return true;
    }

    return (
      title.trim().toLowerCase() ===
      ThreadsService.DEFAULT_THREAD_TITLE.toLowerCase()
    );
  }

  private async maybeGenerateTitleFromFirstMessage(
    input: GenerateTitleFromFirstMessageInput,
  ): Promise<void> {
    if (input.actor.type !== ActorType.HUMAN) {
      return;
    }
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

    await this.threadTitleWorkflow.generateFromFirstMessage(
      input.thread,
      input.actor.id,
      content,
    );
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
      chatSessionId: thread.chatSessionId ?? null,
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

    const { thread, actor, message, existingMessageCount } =
      await this.createThreadMessageUseCase.execute(input);
    const threadWithConversation =
      await this.ensureThreadConversationSession(thread);

    this.logger.log({
      message: 'Thread message created',
      messageId: message.id,
      threadId: input.threadId,
    });

    // Send to chat (fire-and-forget with error handling to prevent unhandled rejection)
    void (async () => {
      try {
        const { agentActorId, events } =
          await this.chatService.streamMessageToConversation({
            conversationId: threadWithConversation.chatSessionId!,
            threadId: threadWithConversation.id,
            message: input.content,
            actor,
          });
        await this.consumeResponseStream(
          events,
          threadWithConversation.id,
          agentActorId,
        );
      } catch (error) {
        this.logger.error({
          message: 'Failed to process agent response stream',
          threadId: threadWithConversation.id,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack, name: error.name }
              : String(error),
        });
      }
    })();

    await this.maybeGenerateTitleFromFirstMessage({
      thread,
      actor,
      messageContent: input.content,
      existingMessageCount,
    });

    return this.mapThreadMessageToResult(message);
  }

  private emitAgentActivity(input: EmitAgentActivityInput): void {
    this.eventEmitter.emit(
      ThreadAgentActivityEvent.INTERNAL,
      new ThreadAgentActivityEvent(
        { id: input.actorId },
        {
          threadId: input.threadId,
          kind: input.kind,
        },
      ),
    );
  }

  private emitAgentResponseDelta(input: EmitAgentResponseDeltaInput): void {
    this.eventEmitter.emit(
      ThreadAgentResponseDeltaEvent.INTERNAL,
      new ThreadAgentResponseDeltaEvent(
        { id: input.actorId },
        {
          threadId: input.threadId,
          streamId: input.streamId,
          delta: input.delta,
        },
      ),
    );
  }

  private async consumeResponseStream(
    events: AsyncIterable<ChatStreamEvent>,
    threadId: string,
    agentActorId: string,
  ): Promise<void> {
    const responseStreamId = randomUUID();

    for await (const event of events) {
      switch (event.type) {
        case 'agent_activity':
          this.emitAgentActivity({
            threadId,
            actorId: agentActorId,
            kind: event.kind,
          });
          break;
        case 'response_delta':
          this.emitAgentResponseDelta({
            threadId,
            actorId: agentActorId,
            streamId: responseStreamId,
            delta: event.delta,
          });
          break;
        case 'final_response':
          await this.persistAgentMessage({
            threadId,
            content: event.content,
            actorId: agentActorId,
          });
          break;
        case 'error': {
          const errorMessage = `I encountered an error while processing your message: ${event.error.message}`;
          await this.persistAgentMessage({
            threadId,
            content: errorMessage,
            actorId: agentActorId,
          });
          break;
        }
      }
    }
  }

  private async persistAgentMessage(input: {
    threadId: string;
    content: string;
    actorId: string;
  }): Promise<void> {
    try {
      const message = this.threadMessageRepository.create({
        threadId: input.threadId,
        content: input.content,
        createdByActorId: input.actorId,
      });

      const savedMessage = await this.threadMessageRepository.save(message);

      const messageWithRelations = await this.threadMessageRepository.findOne({
        where: { id: savedMessage.id },
        relations: ['createdByActor'],
      });

      if (!messageWithRelations) {
        this.logger.error({
          message: 'Failed to reload agent message after creation',
          threadId: input.threadId,
          messageId: savedMessage.id,
        });
        return;
      }

      this.eventEmitter.emit(
        MessageCreatedEvent.INTERNAL,
        new MessageCreatedEvent({ id: input.actorId }, messageWithRelations),
      );
    } catch (error) {
      this.logger.error({
        message: 'Failed to persist agent message',
        threadId: input.threadId,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack, name: error.name }
            : String(error),
      });
    }
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
      order: { createdAt: 'ASC' },
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
