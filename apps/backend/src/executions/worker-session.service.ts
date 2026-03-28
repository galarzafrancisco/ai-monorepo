import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkerSessionEntity } from './worker-session.entity';
import { WorkerSessionStatus } from './enums';

export interface RegisterWorkerSessionInput {
  oauthClientId: string;
  hostname?: string;
  pid?: number;
  version?: string;
  capabilities?: string[];
  lastSeenIp?: string;
}

export interface UpdateHeartbeatInput {
  sessionId: string;
  lastSeenIp?: string;
}

/**
 * Service for managing worker session lifecycle.
 *
 * Responsibilities:
 * - Register new worker sessions when workers connect
 * - Update heartbeat timestamps to track worker liveness
 * - Mark sessions offline when workers disconnect
 * - Retrieve session information
 */
@Injectable()
export class WorkerSessionService {
  private readonly logger = new Logger(WorkerSessionService.name);

  constructor(
    @InjectRepository(WorkerSessionEntity)
    private readonly workerSessionRepository: Repository<WorkerSessionEntity>,
  ) {}

  /**
   * Register a new worker session.
   *
   * @param input - Worker metadata including oauth client ID and optional metadata
   * @returns The created worker session entity
   */
  async registerSession(
    input: RegisterWorkerSessionInput,
  ): Promise<WorkerSessionEntity> {
    const now = new Date();

    const session = this.workerSessionRepository.create({
      oauthClientId: input.oauthClientId,
      status: WorkerSessionStatus.ONLINE,
      connectedAt: now,
      lastHeartbeatAt: now,
      hostname: input.hostname ?? null,
      pid: input.pid ?? null,
      version: input.version ?? null,
      capabilities: input.capabilities
        ? JSON.stringify(input.capabilities)
        : null,
      lastSeenIp: input.lastSeenIp ?? null,
      drainingAt: null,
    });

    const saved = await this.workerSessionRepository.save(session);

    this.logger.log({
      message: 'Worker session registered',
      sessionId: saved.id,
      oauthClientId: saved.oauthClientId,
      hostname: saved.hostname,
      pid: saved.pid,
      version: saved.version,
    });

    return saved;
  }

  /**
   * Update the heartbeat timestamp for a worker session.
   *
   * @param input - Session ID and optional IP address
   * @returns The updated worker session entity, or null if not found
   */
  async updateHeartbeat(
    input: UpdateHeartbeatInput,
  ): Promise<WorkerSessionEntity | null> {
    const session = await this.workerSessionRepository.findOne({
      where: { id: input.sessionId },
    });

    if (!session) {
      this.logger.warn({
        message: 'Heartbeat for unknown session',
        sessionId: input.sessionId,
      });
      return null;
    }

    session.lastHeartbeatAt = new Date();
    if (input.lastSeenIp) {
      session.lastSeenIp = input.lastSeenIp;
    }

    const updated = await this.workerSessionRepository.save(session);

    this.logger.debug({
      message: 'Worker heartbeat updated',
      sessionId: updated.id,
    });

    return updated;
  }

  /**
   * Mark a worker session as offline.
   *
   * @param sessionId - The session ID to mark offline
   * @returns The updated worker session entity, or null if not found
   */
  async markOffline(sessionId: string): Promise<WorkerSessionEntity | null> {
    const session = await this.workerSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      this.logger.warn({
        message: 'Attempted to mark unknown session offline',
        sessionId,
      });
      return null;
    }

    session.status = WorkerSessionStatus.OFFLINE;

    const updated = await this.workerSessionRepository.save(session);

    this.logger.log({
      message: 'Worker session marked offline',
      sessionId: updated.id,
      oauthClientId: updated.oauthClientId,
    });

    return updated;
  }

  /**
   * Retrieve a worker session by ID.
   *
   * @param sessionId - The session ID to retrieve
   * @returns The worker session entity, or null if not found
   */
  async getSession(sessionId: string): Promise<WorkerSessionEntity | null> {
    return this.workerSessionRepository.findOne({
      where: { id: sessionId },
    });
  }

  /**
   * Retrieve a worker session by OAuth client ID.
   * Returns the most recently connected session if multiple exist.
   *
   * @param oauthClientId - The OAuth client ID to search for
   * @returns The worker session entity, or null if not found
   */
  async getSessionByOAuthClientId(
    oauthClientId: string,
  ): Promise<WorkerSessionEntity | null> {
    return this.workerSessionRepository.findOne({
      where: { oauthClientId },
      order: { connectedAt: 'DESC' },
    });
  }
}
