import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, In } from 'typeorm';
import { SessionEntity } from './session.entity';
import { TaskEntity } from '../taskeroo/task.entity';
import { AgentEntity } from '../agents/agent.entity';
import {
  CreateSessionInput,
  UpdateSessionInput,
  GetSessionInput,
  SessionResult,
  TaskResult,
  ListSessionsInput,
  ListSessionsResult,
} from './dto/service/chat.service.types';
import {
  SessionNotFoundError,
  AdkSessionCreationFailedError,
} from './errors/chat.errors';
import {
  SessionCreatedEvent,
  SessionUpdatedEvent,
  SessionDeletedEvent,
  TaskReferencedEvent,
  TaskSubscribedEvent,
  TaskUnsubscribedEvent,
} from './events/chat.events';
import { randomUUID } from 'crypto';
import { AdkService } from '../adk/adk.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly adkService: AdkService,
  ) {}

  async createSession(input: CreateSessionInput): Promise<SessionResult> {
    this.logger.log(
      `Creating session for agent: ${input.agentId}, project: ${input.project}`,
    );

    // Verify agent exists
    const agent = await this.agentRepository.findOne({
      where: { id: input.agentId },
    });

    if (!agent) {
      throw new Error(`Agent not found: ${input.agentId}`);
    }

    // Create ADK session
    const adkSessionId = await this.createAdkSession(agent);

    // Generate default title if not provided
    const title =
      input.title ||
      `Chat with ${agent.name} - ${new Date().toISOString().split('T')[0]}`;

    const session = this.sessionRepository.create({
      adkSessionId,
      agentId: input.agentId,
      title,
      project: input.project ?? null,
      isArchived: false,
      isPinned: false,
      lastMessageAt: new Date(),
    });

    const savedSession = await this.sessionRepository.save(session);

    // Load with relations
    const sessionWithRelations = await this.sessionRepository.findOne({
      where: { id: savedSession.id },
      relations: ['agent'],
    });

    if (!sessionWithRelations) {
      throw new SessionNotFoundError(savedSession.id);
    }

    this.eventEmitter.emit(
      'session.created',
      new SessionCreatedEvent(sessionWithRelations),
    );

    return this.mapSessionToResult(sessionWithRelations);
  }

  async getSessionById(
    sessionId: string,
    options?: GetSessionInput,
  ): Promise<SessionResult> {
    this.logger.log(`Getting session by ID: ${sessionId}`);

    const relations: string[] = ['agent'];
    if (options?.withTasks) {
      relations.push('referencedTasks', 'subscribedTasks');
    }

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations,
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    return this.mapSessionToResult(session, options?.withTasks);
  }

  async listSessions(input: ListSessionsInput): Promise<ListSessionsResult> {
    this.logger.log(`Listing sessions with filters: ${JSON.stringify(input)}`);

    const skip = (input.page - 1) * input.limit;

    const whereClause: Record<string, unknown> = {};
    if (input.agentId !== undefined) {
      whereClause.agentId = input.agentId;
    }
    if (input.project !== undefined) {
      whereClause.project = input.project;
    }
    if (input.isArchived !== undefined) {
      whereClause.isArchived = input.isArchived;
    }
    if (input.isPinned !== undefined) {
      whereClause.isPinned = input.isPinned;
    }

    const [sessions, total] = await this.sessionRepository.findAndCount({
      where: whereClause,
      relations: ['agent'],
      order: { lastMessageAt: 'DESC' },
      skip,
      take: input.limit,
    });

    return {
      items: sessions.map((session) => this.mapSessionToResult(session)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async updateSession(
    sessionId: string,
    input: UpdateSessionInput,
  ): Promise<SessionResult> {
    this.logger.log(`Updating session: ${sessionId}`);

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['agent'],
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Apply partial updates
    if (input.title !== undefined) session.title = input.title;
    if (input.project !== undefined) session.project = input.project;
    if (input.isArchived !== undefined) session.isArchived = input.isArchived;
    if (input.isPinned !== undefined) session.isPinned = input.isPinned;

    const updatedSession = await this.sessionRepository.save(session);

    this.eventEmitter.emit(
      'session.updated',
      new SessionUpdatedEvent(updatedSession),
    );

    return this.mapSessionToResult(updatedSession);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.logger.log(`Deleting session: ${sessionId}`);

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    await this.sessionRepository.softRemove(session);

    this.eventEmitter.emit('session.deleted', new SessionDeletedEvent(sessionId));
  }

  async addReferencedTask(sessionId: string, taskId: string): Promise<void> {
    this.logger.log(
      `Adding referenced task ${taskId} to session ${sessionId}`,
    );

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['referencedTasks'],
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Check if task is already referenced
    const isAlreadyReferenced = session.referencedTasks.some(
      (t) => t.id === taskId,
    );

    if (!isAlreadyReferenced) {
      session.referencedTasks.push(task);
      await this.sessionRepository.save(session);

      this.eventEmitter.emit(
        'task.referenced',
        new TaskReferencedEvent(sessionId, taskId),
      );
    }
  }

  async addSubscribedTask(sessionId: string, taskId: string): Promise<void> {
    this.logger.log(
      `Adding subscribed task ${taskId} to session ${sessionId}`,
    );

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['subscribedTasks'],
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Check if task is already subscribed
    const isAlreadySubscribed = session.subscribedTasks.some(
      (t) => t.id === taskId,
    );

    if (!isAlreadySubscribed) {
      session.subscribedTasks.push(task);
      await this.sessionRepository.save(session);

      this.eventEmitter.emit(
        'task.subscribed',
        new TaskSubscribedEvent(sessionId, taskId),
      );
    }
  }

  async removeSubscribedTask(sessionId: string, taskId: string): Promise<void> {
    this.logger.log(
      `Removing subscribed task ${taskId} from session ${sessionId}`,
    );

    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['subscribedTasks'],
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    session.subscribedTasks = session.subscribedTasks.filter(
      (task) => task.id !== taskId,
    );

    await this.sessionRepository.save(session);

    this.eventEmitter.emit(
      'task.unsubscribed',
      new TaskUnsubscribedEvent(sessionId, taskId),
    );
  }

  private async createAdkSession(agent: AgentEntity): Promise<string> {
    try {
      // Use agent slug as ADK app name
      const appId = agent.slug;

      // Use agent ID as the userId for ADK session
      const userId = agent.id;

      this.logger.log(
        `Creating ADK session for app: ${appId}, user: ${userId}`,
      );

      // Call ADK service to create session
      const response = await this.adkService.createSession(appId, userId);

      if (!response.id) {
        throw new AdkSessionCreationFailedError(
          `ADK session creation failed for agent ${agent.name}: No session ID returned`,
        );
      }

      this.logger.log(
        `Successfully created ADK session: ${response.id}`,
      );

      return response.id;
    } catch (error) {
      this.logger.error(
        `Failed to create ADK session for agent ${agent.name}: ${error}`,
      );
      throw new AdkSessionCreationFailedError(
        `ADK session creation failed for agent ${agent.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private mapSessionToResult(
    session: SessionEntity,
    includeTasks = false,
  ): SessionResult {
    const result: SessionResult = {
      id: session.id,
      adkSessionId: session.adkSessionId,
      agentId: session.agentId,
      title: session.title,
      project: session.project,
      isArchived: session.isArchived,
      isPinned: session.isPinned,
      lastMessageAt: session.lastMessageAt,
      rowVersion: session.rowVersion,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      deletedAt: session.deletedAt ?? null,
    };

    if (includeTasks) {
      result.referencedTasks = session.referencedTasks?.map((task) =>
        this.mapTaskToResult(task),
      );
      result.subscribedTasks = session.subscribedTasks?.map((task) =>
        this.mapTaskToResult(task),
      );
    }

    return result;
  }

  private mapTaskToResult(task: TaskEntity): TaskResult {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      assignee: task.assignee,
    };
  }

  async sendMessage(
    sessionId: string,
    message: string,
  ): Promise<{ events: any[] }> {
    // Get session with agent relation
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['agent'],
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (!session.agent) {
      throw new Error(`Agent not found for session ${sessionId}`);
    }

    try {
      // Send message to ADK
      const response = await this.adkService.run({
        app_name: session.agent.slug,
        user_id: session.agentId,
        session_id: session.adkSessionId,
        new_message: {
          role: 'user',
          parts: [{ text: message }],
        },
      });

      // Update lastMessageAt
      session.lastMessageAt = new Date();
      await this.sessionRepository.save(session);

      return { events: response };
    } catch (error) {
      this.logger.error(
        `Failed to send message to ADK for session ${sessionId}: ${error}`,
      );
      throw new Error(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async *sendMessageStream(
    sessionId: string,
    message: string,
  ): AsyncGenerator<any, void, unknown> {
    // Get session with agent relation
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['agent'],
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (!session.agent) {
      throw new Error(`Agent not found for session ${sessionId}`);
    }

    try {
      // Send message to ADK with streaming
      const stream = this.adkService.runSSE({
        app_name: session.agent.slug,
        user_id: session.agentId,
        session_id: session.adkSessionId,
        new_message: {
          role: 'user',
          parts: [{ text: message }],
        },
      });

      for await (const event of stream) {
        yield event;
      }

      // Update lastMessageAt after stream completes
      session.lastMessageAt = new Date();
      await this.sessionRepository.save(session);
    } catch (error) {
      this.logger.error(
        `Failed to send streaming message to ADK for session ${sessionId}: ${error}`,
      );
      throw new Error(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
