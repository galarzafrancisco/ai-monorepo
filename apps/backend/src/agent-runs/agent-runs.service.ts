import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentRunEntity } from './agent-run.entity';
import {
  CreateAgentRunInput,
  UpdateAgentRunInput,
  AgentRunResult,
  ListAgentRunsInput,
  ListAgentRunsResult,
  ActorResult,
  TaskResult,
} from './dto/service/agent-runs.service.types';
import { AgentRunNotFoundError } from './errors/agent-runs.errors';
import { ActorEntity } from '../identity-provider/actor.entity';
import { TaskEntity } from '../tasks/task.entity';

@Injectable()
export class AgentRunsService {
  private readonly logger = new Logger(AgentRunsService.name);

  constructor(
    @InjectRepository(AgentRunEntity)
    private readonly agentRunRepository: Repository<AgentRunEntity>,
  ) {}

  async createAgentRun(input: CreateAgentRunInput): Promise<AgentRunResult> {
    this.logger.log({
      message: 'Creating agent run',
      actorId: input.actorId,
      parentTaskId: input.parentTaskId,
    });

    const agentRun = this.agentRunRepository.create({
      actorId: input.actorId,
      parentTaskId: input.parentTaskId,
      startedAt: null,
      endedAt: null,
      lastPing: null,
      taskExecutionId: input.taskExecutionId ?? null,
    });

    const savedAgentRun = await this.agentRunRepository.save(agentRun);

    // Reload with relations
    const agentRunWithRelations = await this.agentRunRepository.findOne({
      where: { id: savedAgentRun.id },
      relations: ['actor', 'parentTask'],
    });

    if (!agentRunWithRelations) {
      throw new AgentRunNotFoundError(savedAgentRun.id);
    }

    this.logger.log({
      message: 'Agent run created',
      runId: agentRunWithRelations.id,
    });

    return this.mapAgentRunToResult(agentRunWithRelations);
  }

  async updateAgentRun(
    runId: string,
    input: UpdateAgentRunInput,
  ): Promise<AgentRunResult> {
    this.logger.log({
      message: 'Updating agent run',
      runId,
    });

    const agentRun = await this.agentRunRepository.findOne({
      where: { id: runId },
      relations: ['actor', 'parentTask'],
    });

    if (!agentRun) {
      throw new AgentRunNotFoundError(runId);
    }

    // Apply partial updates
    if (input.startedAt !== undefined) agentRun.startedAt = input.startedAt;
    if (input.endedAt !== undefined) agentRun.endedAt = input.endedAt;
    if (input.lastPing !== undefined) agentRun.lastPing = input.lastPing;
    if (input.taskExecutionId !== undefined)
      agentRun.taskExecutionId = input.taskExecutionId;

    const updatedAgentRun = await this.agentRunRepository.save(agentRun);

    // Reload with relations
    const agentRunWithRelations = await this.agentRunRepository.findOne({
      where: { id: runId },
      relations: ['actor', 'parentTask'],
    });

    if (!agentRunWithRelations) {
      throw new AgentRunNotFoundError(runId);
    }

    this.logger.log({
      message: 'Agent run updated',
      runId: agentRunWithRelations.id,
    });

    return this.mapAgentRunToResult(agentRunWithRelations);
  }

  async getAgentRunById(runId: string): Promise<AgentRunResult> {
    const agentRun = await this.agentRunRepository.findOne({
      where: { id: runId },
      relations: ['actor', 'parentTask'],
    });

    if (!agentRun) {
      throw new AgentRunNotFoundError(runId);
    }

    return this.mapAgentRunToResult(agentRun);
  }

  async listAgentRuns(input: ListAgentRunsInput): Promise<ListAgentRunsResult> {
    this.logger.log({
      message: 'Listing agent runs',
      filters: {
        actorId: input.actorId,
        parentTaskId: input.parentTaskId,
      },
      page: input.page,
      limit: input.limit,
    });

    const skip = (input.page - 1) * input.limit;

    const queryBuilder = this.agentRunRepository
      .createQueryBuilder('agentRun')
      .leftJoinAndSelect('agentRun.actor', 'actor')
      .leftJoinAndSelect('agentRun.parentTask', 'parentTask');

    if (input.actorId) {
      queryBuilder.andWhere('agentRun.actorId = :actorId', {
        actorId: input.actorId,
      });
    }

    if (input.parentTaskId) {
      queryBuilder.andWhere('agentRun.parentTaskId = :parentTaskId', {
        parentTaskId: input.parentTaskId,
      });
    }

    queryBuilder
      .orderBy('agentRun.createdAt', 'DESC')
      .skip(skip)
      .take(input.limit);

    const [agentRuns, total] = await queryBuilder.getManyAndCount();

    this.logger.log({
      message: 'Agent runs listed',
      count: agentRuns.length,
      total,
      page: input.page,
    });

    return {
      items: agentRuns.map((run) => this.mapAgentRunToResult(run)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  private mapAgentRunToResult(agentRun: AgentRunEntity): AgentRunResult {
    return {
      id: agentRun.id,
      actorId: agentRun.actorId,
      actor: agentRun.actor ? this.mapActorToResult(agentRun.actor) : null,
      parentTaskId: agentRun.parentTaskId,
      parentTask: agentRun.parentTask
        ? this.mapTaskToResult(agentRun.parentTask)
        : null,
      createdAt: agentRun.createdAt,
      startedAt: agentRun.startedAt,
      endedAt: agentRun.endedAt,
      lastPing: agentRun.lastPing,
      taskExecutionId: agentRun.taskExecutionId,
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

  private mapTaskToResult(task: TaskEntity): TaskResult {
    return {
      id: task.id,
      name: task.name,
    };
  }
}
