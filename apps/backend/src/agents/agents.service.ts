import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { AgentEntity } from './agent.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { ActorType } from '../identity-provider/enums';
import { AgentType } from './enums';
import {
  CreateAgentInput,
  UpdateAgentInput,
  PatchAgentInput,
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
import { DEFAULT_AGENT_AVATAR } from './enums/agent-type.enum';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async createAgent(input: CreateAgentInput): Promise<AgentResult> {
    this.logger.log(`Creating agent with slug: ${input.slug}`);

    // Check for slug conflict using actor repository
    const existingActor = await this.actorRepository.findOne({
      where: { slug: input.slug },
    });

    // TODO: not really needed hey. DB should throw on write because slug is unique.
    if (existingActor) {
      throw new AgentSlugConflictError(input.slug);
    }

    // Create actor first
    let avatarUrl: string | null = null;
    if (input.avatarUrl !== undefined) {
      avatarUrl = input.avatarUrl;
    } else if (input.type !== undefined) {
      avatarUrl = DEFAULT_AGENT_AVATAR[input.type];
    }
    const actor = this.actorRepository.create({
      type: ActorType.AGENT,
      slug: input.slug,
      displayName: input.name,
      avatarUrl: avatarUrl,
    });
    const savedActor = await this.actorRepository.save(actor);

    const agent = this.agentRepository.create({
      actorId: savedActor.id,
      type: input.type ?? AgentType.OTHER,
      description: input.description ?? null,
      systemPrompt: input.systemPrompt ?? '',
      statusTriggers: input.statusTriggers ?? [],
      allowedTools: input.allowedTools ?? [],
      isActive: input.isActive ?? true,
      concurrencyLimit: input.concurrencyLimit ?? null,
    });

    const savedAgent = await this.agentRepository.save(agent);

    // Load with actor relation
    const agentWithRelations = await this.agentRepository.findOne({
      where: { id: savedAgent.id },
      relations: ['actor'],
    });

    if (!agentWithRelations) {
      throw new AgentNotFoundError(savedAgent.id);
    }
    if (!agentWithRelations.actor) {
      throw new AgentNotFoundError(savedAgent.id);
    }

    this.eventEmitter.emit(
      'agent.created',
      new AgentCreatedEvent(agentWithRelations),
    );

    return this.mapAgentToResult(agentWithRelations, agentWithRelations.actor);
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
      relations: ['actor'],
      order: { createdAt: 'DESC' },
      skip,
      take: input.limit,
    });


    return {
      items: agents.map((agent) => {
        const actor = agent.actor as ActorEntity;
        return this.mapAgentToResult(agent, actor);
      }),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async getAgentById({ agentId }: { agentId: string }): Promise<AgentResult> {
    this.logger.log(`Getting agent by ID: ${agentId}`);

    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
      relations: ['actor'],
    });

    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }
    if (!agent.actor) {
      throw new AgentNotFoundError(agentId);
    }

    return this.mapAgentToResult(agent, agent.actor);
  }

  async getAgentBySlug({ slug }: { slug: string }): Promise<AgentResult> {
    this.logger.log(`Getting agent by slug: ${slug}`);

    const agent = await this.agentRepository
      .createQueryBuilder('agent')
      .innerJoinAndSelect('agent.actor', 'actor')
      .where('actor.slug = :slug', { slug })
      .getOne();

    if (!agent) {
      throw new AgentNotFoundError(slug);
    }
    if (!agent.actor) {
      throw new AgentNotFoundError(slug);
    }

    return this.mapAgentToResult(agent, agent.actor);
  }

  // async updateAgent(
  //   actorId: string,
  //   input: UpdateAgentInput,
  // ): Promise<AgentResult> {
  //   this.logger.log(`Updating agent: ${agentId}`);

  //   const agent = await this.agentRepository.findOne({
  //     where: { id: agentId },
  //     relations: ['actor'],
  //   });

  //   if (!agent) {
  //     throw new AgentNotFoundError(agentId);
  //   }

  //   // Check for slug conflict if slug is being updated
  //   if (input.slug !== undefined && input.slug !== agent.actor?.slug) {
  //     const existingActor = await this.actorRepository.findOne({
  //       where: { slug: input.slug },
  //     });

  //     if (existingActor && existingActor.id !== agent.actorId) {
  //       throw new AgentSlugConflictError(input.slug);
  //     }
  //   }

  //   // Apply partial updates to agent
  //   if (input.type !== undefined) agent.type = input.type;
  //   if (input.description !== undefined) agent.description = input.description;
  //   if (input.systemPrompt !== undefined)
  //     agent.systemPrompt = input.systemPrompt;
  //   if (input.statusTriggers !== undefined)
  //     agent.statusTriggers = input.statusTriggers;
  //   if (input.allowedTools !== undefined)
  //     agent.allowedTools = input.allowedTools;
  //   if (input.isActive !== undefined) agent.isActive = input.isActive;
  //   if (input.concurrencyLimit !== undefined)
  //     agent.concurrencyLimit = input.concurrencyLimit;

  //   // Update actor if name or slug changed
  //   if (agent.actor && (input.name !== undefined || input.slug !== undefined)) {
  //     if (input.name !== undefined) agent.actor.displayName = input.name;
  //     if (input.slug !== undefined) agent.actor.slug = input.slug;
  //     await this.actorRepository.save(agent.actor);
  //   }

  //   const updatedAgent = await this.agentRepository.save(agent);

  //   // Reload with actor relation
  //   const agentWithRelations = await this.agentRepository.findOne({
  //     where: { id: updatedAgent.id },
  //     relations: ['actor'],
  //   });
  //   if (!agentWithRelations || !agentWithRelations.actor) {
  //     throw new AgentNotFoundError(updatedAgent.id);
  //   }

  //   this.eventEmitter.emit(
  //     'agent.updated',
  //     new AgentUpdatedEvent(agentWithRelations!),
  //   );

  //   return this.mapAgentToResult(agentWithRelations);
  // }

  async deleteAgent(actorId: string): Promise<void> {
    this.logger.log(`Deleting agent with actorId: ${actorId}`);

    const agent = await this.agentRepository.findOne({
      where: { actorId },
    });

    if (!agent) {
      throw new AgentNotFoundError(actorId);
    }

    await this.agentRepository.softRemove(agent);

    this.eventEmitter.emit('agent.deleted', new AgentDeletedEvent(actorId));
  }

  async patchAgent(
    actorId: string,
    input: PatchAgentInput,
  ): Promise<AgentResult> {
    this.logger.log(`Patching agent with actorId: ${actorId}`);

    // Find agent by actorId
    const agent = await this.agentRepository.findOne({
      where: { actorId },
      relations: ['actor'],
    });

    if (!agent) {
      throw new AgentNotFoundError(actorId);
    }
    if (!agent.actor) {
      throw new AgentNotFoundError(actorId);
    }

    // Apply partial updates to agent
    if (input.systemPrompt !== undefined) {
      agent.systemPrompt = input.systemPrompt;
    }
    if (input.statusTriggers !== undefined) {
      agent.statusTriggers = input.statusTriggers;
    }
    if (input.type !== undefined) {
      agent.type = input.type;
    }

    const updatedAgent = await this.agentRepository.save(agent);

    // Reload with actor relation
    const agentWithRelations = await this.agentRepository.findOne({
      where: { id: updatedAgent.id },
      relations: ['actor'],
    });
    if (!agentWithRelations || !agentWithRelations.actor) {
      throw new AgentNotFoundError(updatedAgent.id);
    }

    this.eventEmitter.emit(
      'agent.updated',
      new AgentUpdatedEvent(agentWithRelations),
    );

    return this.mapAgentToResult(agentWithRelations, agentWithRelations.actor);
  }

  private mapAgentToResult(agent: AgentEntity, actor: ActorEntity): AgentResult {
    return {
      actorId: actor.id,
      slug: actor.slug,
      name: actor.displayName,
      type: agent.type,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      statusTriggers: agent.statusTriggers,
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
