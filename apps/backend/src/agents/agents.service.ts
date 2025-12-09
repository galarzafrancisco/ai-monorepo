import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { AgentEntity } from './agent.entity';
import {
  CreateAgentInput,
  UpdateAgentInput,
  AgentResult,
  ListAgentsInput,
  ListAgentsResult,
} from './dto/service/agents.service.types';
import {
  AgentNotFoundError,
  AgentSlugConflictError,
} from './errors/agents.errors';
import {
  AgentCreatedEvent,
  AgentUpdatedEvent,
  AgentDeletedEvent,
} from './events/agents.events';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createAgent(input: CreateAgentInput): Promise<AgentResult> {
    this.logger.log(`Creating agent with slug: ${input.slug}`);

    // Check for slug conflict
    const existingAgent = await this.agentRepository.findOne({
      where: { slug: input.slug },
    });

    if (existingAgent) {
      throw new AgentSlugConflictError(input.slug);
    }

    const agent = this.agentRepository.create({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      systemPrompt: input.systemPrompt,
      allowedTools: input.allowedTools,
      isActive: input.isActive ?? true,
      concurrencyLimit: input.concurrencyLimit ?? null,
    });

    const savedAgent = await this.agentRepository.save(agent);

    // Load with relations (none for now, but following the pattern)
    const agentWithRelations = await this.agentRepository.findOne({
      where: { id: savedAgent.id },
    });

    if (!agentWithRelations) {
      throw new AgentNotFoundError(savedAgent.id);
    }

    this.eventEmitter.emit(
      'agent.created',
      new AgentCreatedEvent(agentWithRelations),
    );

    return this.mapAgentToResult(agentWithRelations);
  }

  async listAgents(input: ListAgentsInput): Promise<ListAgentsResult> {
    this.logger.log(
      `Listing agents with filters: ${JSON.stringify(input)}`,
    );

    const skip = (input.page - 1) * input.limit;

    const whereClause: Record<string, unknown> = {};
    if (input.isActive !== undefined) {
      whereClause.isActive = input.isActive;
    }

    const [agents, total] = await this.agentRepository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      skip,
      take: input.limit,
    });

    return {
      items: agents.map((agent) => this.mapAgentToResult(agent)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async getAgentById(agentId: string): Promise<AgentResult> {
    this.logger.log(`Getting agent by ID: ${agentId}`);

    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    return this.mapAgentToResult(agent);
  }

  async getAgentBySlug(slug: string): Promise<AgentResult> {
    this.logger.log(`Getting agent by slug: ${slug}`);

    const agent = await this.agentRepository.findOne({
      where: { slug },
    });

    if (!agent) {
      throw new AgentNotFoundError(slug);
    }

    return this.mapAgentToResult(agent);
  }

  async getAgentByIdOrSlug(idOrSlug: string): Promise<AgentResult> {
    this.logger.log(`Getting agent by ID or slug: ${idOrSlug}`);

    // UUID regex pattern
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidPattern.test(idOrSlug);

    // Try slug first (more user-friendly), then fall back to UUID for backward compatibility
    let agent = await this.agentRepository.findOne({
      where: { slug: idOrSlug },
    });

    // If not found by slug and input looks like a UUID, try by ID
    if (!agent && isUuid) {
      agent = await this.agentRepository.findOne({
        where: { id: idOrSlug },
      });
    }

    if (!agent) {
      throw new AgentNotFoundError(idOrSlug);
    }

    return this.mapAgentToResult(agent);
  }

  async updateAgent(
    agentId: string,
    input: UpdateAgentInput,
  ): Promise<AgentResult> {
    this.logger.log(`Updating agent: ${agentId}`);

    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    // Check for slug conflict if slug is being updated
    if (input.slug !== undefined && input.slug !== agent.slug) {
      const existingAgent = await this.agentRepository.findOne({
        where: { slug: input.slug },
      });

      if (existingAgent) {
        throw new AgentSlugConflictError(input.slug);
      }
    }

    // Apply partial updates
    if (input.slug !== undefined) agent.slug = input.slug;
    if (input.name !== undefined) agent.name = input.name;
    if (input.description !== undefined) agent.description = input.description;
    if (input.systemPrompt !== undefined)
      agent.systemPrompt = input.systemPrompt;
    if (input.allowedTools !== undefined)
      agent.allowedTools = input.allowedTools;
    if (input.isActive !== undefined) agent.isActive = input.isActive;
    if (input.concurrencyLimit !== undefined)
      agent.concurrencyLimit = input.concurrencyLimit;

    const updatedAgent = await this.agentRepository.save(agent);

    this.eventEmitter.emit(
      'agent.updated',
      new AgentUpdatedEvent(updatedAgent),
    );

    return this.mapAgentToResult(updatedAgent);
  }

  async deleteAgent(agentId: string): Promise<void> {
    this.logger.log(`Deleting agent: ${agentId}`);

    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    await this.agentRepository.softRemove(agent);

    this.eventEmitter.emit('agent.deleted', new AgentDeletedEvent(agentId));
  }

  private mapAgentToResult(agent: AgentEntity): AgentResult {
    return {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      allowedTools: agent.allowedTools,
      isActive: agent.isActive,
      concurrencyLimit: agent.concurrencyLimit,
      rowVersion: agent.rowVersion,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      deletedAt: agent.deletedAt ?? null,
    };
  }
}
