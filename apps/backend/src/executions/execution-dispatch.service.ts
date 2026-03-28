import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from '../agents/agent.entity';
import { ExecutionClaimService } from './execution-claim.service';
import {
  ExecutionReadyForDispatchEvent,
  WorkerAvailableForDispatchEvent,
} from './events/execution-dispatch.events';
import { TaskExecutionStatus, WorkerSessionStatus } from './enums';
import { TaskExecutionEntity } from './task-execution.entity';
import { WorkerSessionEntity } from './worker-session.entity';
import { WorkersGateway } from './workers.gateway';

const ACTIVE_EXECUTION_STATUSES: readonly TaskExecutionStatus[] = [
  TaskExecutionStatus.CLAIMED,
  TaskExecutionStatus.RUNNING,
  TaskExecutionStatus.STOP_REQUESTED,
];

@Injectable()
export class ExecutionDispatchService {
  private readonly logger = new Logger(ExecutionDispatchService.name);
  private readonly leaseDurationMs = 10 * 60 * 1000;

  constructor(
    @InjectRepository(TaskExecutionEntity)
    private readonly executionRepository: Repository<TaskExecutionEntity>,
    @InjectRepository(WorkerSessionEntity)
    private readonly workerSessionRepository: Repository<WorkerSessionEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    private readonly executionClaimService: ExecutionClaimService,
    private readonly workersGateway: WorkersGateway,
  ) {}

  @OnEvent(ExecutionReadyForDispatchEvent.INTERNAL)
  async onExecutionReady(event: ExecutionReadyForDispatchEvent): Promise<void> {
    this.logger.log({
      message: 'Execution ready event received for dispatch',
      executionId: event.executionId,
    });
    await this.dispatchExecution(event.executionId);
  }

  @OnEvent(WorkerAvailableForDispatchEvent.INTERNAL)
  async onWorkerAvailable(
    event: WorkerAvailableForDispatchEvent,
  ): Promise<void> {
    this.logger.log({
      message: 'Worker available event received for dispatch',
      sessionId: event.sessionId,
    });
    await this.dispatchNextForWorker(event.sessionId);
  }

  private async dispatchExecution(executionId: string): Promise<void> {
    const execution = await this.loadDispatchableExecution(executionId);
    if (!execution) {
      this.logger.debug({
        message: 'Execution is not dispatchable',
        executionId,
      });
      return;
    }

    const session = await this.findAvailableWorkerSession();
    if (!session) {
      this.logger.debug({
        message: 'No available worker session to dispatch execution',
        executionId,
      });
      return;
    }

    await this.assignExecutionToSession(execution, session);
  }

  private async dispatchNextForWorker(sessionId: string): Promise<void> {
    const session = await this.findAvailableWorkerSession(sessionId);
    if (!session) {
      this.logger.debug({
        message: 'Worker session is not currently available for dispatch',
        sessionId,
      });
      return;
    }

    const execution = await this.findNextReadyExecution();
    if (!execution) {
      this.logger.debug({
        message: 'No READY execution available for worker session',
        sessionId,
      });
      return;
    }

    await this.assignExecutionToSession(execution, session);
  }

  private async assignExecutionToSession(
    execution: TaskExecutionEntity,
    session: WorkerSessionEntity,
  ): Promise<void> {
    const claimed = await this.executionClaimService.claimExecution({
      executionId: execution.id,
      workerSessionId: session.id,
      leaseDurationMs: this.leaseDurationMs,
    });

    if (!claimed) {
      this.logger.debug({
        message: 'Execution claim lost before dispatch',
        executionId: execution.id,
        sessionId: session.id,
      });
      return;
    }

    this.workersGateway.emitRunAssigned(session.id, {
      executionId: claimed.executionId,
      taskId: claimed.taskId,
      agentActorId: claimed.agentActorId,
      triggerReason: execution.triggerReason ?? undefined,
    });

    this.logger.log({
      message: 'Execution dispatched to worker session',
      executionId: execution.id,
      sessionId: session.id,
      taskId: execution.taskId,
    });
  }

  private async loadDispatchableExecution(
    executionId: string,
  ): Promise<TaskExecutionEntity | null> {
    const execution = await this.executionRepository.findOne({
      where: { id: executionId },
    });

    if (!execution || execution.status !== TaskExecutionStatus.READY) {
      this.logger.debug({
        message: 'Execution is missing or not in READY state',
        executionId,
        status: execution?.status,
      });
      return null;
    }

    const agent = await this.agentRepository.findOne({
      where: { actorId: execution.agentActorId },
    });

    if (!agent || !agent.isActive) {
      this.logger.debug({
        message: 'Execution skipped because agent is missing or inactive',
        executionId,
        agentActorId: execution.agentActorId,
        agentFound: Boolean(agent),
        agentActive: agent?.isActive ?? false,
      });
      return null;
    }

    return execution;
  }

  private async findNextReadyExecution(): Promise<TaskExecutionEntity | null> {
    const executions = await this.executionRepository.find({
      where: { status: TaskExecutionStatus.READY },
      order: { requestedAt: 'ASC' },
      take: 25,
    });

    for (const execution of executions) {
      const dispatchable = await this.loadDispatchableExecution(execution.id);
      if (dispatchable) {
        return dispatchable;
      }
    }

    return null;
  }

  private async findAvailableWorkerSession(
    preferredSessionId?: string,
  ): Promise<WorkerSessionEntity | null> {
    if (preferredSessionId) {
      const preferred = await this.workerSessionRepository.findOne({
        where: { id: preferredSessionId },
      });
      this.logger.debug({
        message: 'Checking preferred worker session for availability',
        sessionId: preferredSessionId,
        found: Boolean(preferred),
      });
      if (preferred && (await this.isSessionAvailable(preferred))) {
        return preferred;
      }
      return null;
    }

    const sessions = await this.workerSessionRepository.find({
      where: { status: WorkerSessionStatus.ONLINE },
      order: { lastHeartbeatAt: 'DESC', connectedAt: 'ASC' },
      take: 25,
    });

    for (const session of sessions) {
      this.logger.debug({
        message: 'Checking online worker session for availability',
        sessionId: session.id,
      });
      if (await this.isSessionAvailable(session)) {
        return session;
      }
    }

    return null;
  }

  private async isSessionAvailable(
    session: WorkerSessionEntity,
  ): Promise<boolean> {
    if (session.status !== WorkerSessionStatus.ONLINE) {
      this.logger.debug({
        message: 'Worker session is not ONLINE',
        sessionId: session.id,
        status: session.status,
      });
      return false;
    }

    if (!(await this.workersGateway.hasActiveSession(session.id))) {
      this.logger.debug({
        message: 'Worker session has no active websocket room membership',
        sessionId: session.id,
      });
      return false;
    }

    const activeExecutionCount = await this.executionRepository
      .createQueryBuilder('execution')
      .where('execution.worker_session_id = :sessionId', {
        sessionId: session.id,
      })
      .andWhere('execution.status IN (:...statuses)', {
        statuses: ACTIVE_EXECUTION_STATUSES,
      })
      .getCount();

    const available = activeExecutionCount === 0;
    this.logger.debug({
      message: 'Worker session active execution check',
      sessionId: session.id,
      activeExecutionCount,
      available,
    });

    return available;
  }
}
