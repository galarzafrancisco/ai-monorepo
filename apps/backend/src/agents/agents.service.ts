import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository, QueryFailedError } from 'typeorm';
import { AgentEntity } from './agent.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { ActorType } from '../identity-provider/enums';
import { AgentType } from './enums';
import {
  CreateAgentInput,
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
import { AGENT_TEMPLATE_CATALOG } from './agent-template.catalog';
import { AgentTemplateCatalogResponseDto } from './dto/agent-template-catalog-response.dto';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createAgent(input: CreateAgentInput): Promise<AgentResult> {
    this.logger.log(`Creating agent with slug: ${input.slug}`);

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
      introduction: input.introduction ?? null,
    });

    // Save actor with slug uniqueness check
    let savedActor: ActorEntity;
    try {
      savedActor = await this.actorRepository.save(actor);
    } catch (error) {
      // Convert DB unique constraint violation on actor.slug to domain error
      if (error instanceof QueryFailedError) {
        const driverError = (error as any).driverError;
        // Check for SQLite UNIQUE constraint on actor.slug
        if (
          driverError?.code === 'SQLITE_CONSTRAINT' &&
          driverError?.message?.includes('actor.slug')
        ) {
          throw new AgentSlugConflictError(input.slug);
        }
      }
      throw error;
    }

    const agent = this.agentRepository.create({
      actorId: savedActor.id,
      type: input.type ?? AgentType.OTHER,
      description: input.description ?? null,
      systemPrompt: input.systemPrompt ?? '',
      providerId: this.normalizeOptionalId(input.providerId),
      modelId: this.normalizeOptionalId(input.modelId),
      statusTriggers: input.statusTriggers ?? [],
      tagTriggers: input.tagTriggers ?? [],
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
    this.logger.log(`Listing agents with filters: ${JSON.stringify(input)}`);

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

  getTemplateCatalog(): AgentTemplateCatalogResponseDto {
    return AGENT_TEMPLATE_CATALOG;
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

  async getActiveAgentsByActorIds({
    actorIds,
  }: {
    actorIds: string[];
  }): Promise<AgentResult[]> {
    if (actorIds.length === 0) {
      return [];
    }

    const agents = await this.agentRepository.find({
      where: actorIds.map((actorId) => ({
        actorId,
        isActive: true,
      })),
      relations: ['actor'],
    });

    return agents
      .filter((agent): agent is AgentEntity & { actor: ActorEntity } =>
        Boolean(agent.actor),
      )
      .map((agent) => this.mapAgentToResult(agent, agent.actor));
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

    if (input.slug !== undefined && input.slug !== agent.actor.slug) {
      const existingActor = await this.actorRepository.findOne({
        where: { slug: input.slug },
      });

      if (existingActor && existingActor.id !== agent.actorId) {
        throw new AgentSlugConflictError(input.slug);
      }
    }

    // Apply partial updates to agent
    if (input.systemPrompt !== undefined) {
      agent.systemPrompt = input.systemPrompt;
    }
    if (input.providerId !== undefined) {
      agent.providerId = this.normalizeOptionalId(input.providerId);
    }
    if (input.modelId !== undefined) {
      agent.modelId = this.normalizeOptionalId(input.modelId);
    }
    if (input.statusTriggers !== undefined) {
      agent.statusTriggers = input.statusTriggers;
    }
    if (input.tagTriggers !== undefined) {
      agent.tagTriggers = input.tagTriggers;
    }
    if (input.type !== undefined) {
      agent.type = input.type;
    }
    if (input.description !== undefined) {
      agent.description = input.description;
    }
    if (input.allowedTools !== undefined) {
      agent.allowedTools = input.allowedTools;
    }
    if (input.isActive !== undefined) {
      agent.isActive = input.isActive;
    }
    if (input.concurrencyLimit !== undefined) {
      agent.concurrencyLimit = input.concurrencyLimit;
    }

    // Apply updates to actor fields
    if (input.name !== undefined) {
      agent.actor.displayName = input.name;
    }
    if (input.slug !== undefined) {
      agent.actor.slug = input.slug;
    }
    if (input.introduction !== undefined) {
      agent.actor.introduction = input.introduction;
    }
    if (input.avatarUrl !== undefined) {
      agent.actor.avatarUrl = input.avatarUrl;
    }

    const isActorUpdateRequested =
      input.name !== undefined ||
      input.slug !== undefined ||
      input.introduction !== undefined ||
      input.avatarUrl !== undefined;

    if (isActorUpdateRequested) {
      try {
        await this.actorRepository.save(agent.actor);
      } catch (error) {
        if (error instanceof QueryFailedError) {
          const driverError = (error as any).driverError;
          if (
            driverError?.code === 'SQLITE_CONSTRAINT' &&
            driverError?.message?.includes('actor.slug')
          ) {
            throw new AgentSlugConflictError(agent.actor.slug);
          }
        }
        throw error;
      }
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

  private mapAgentToResult(
    agent: AgentEntity,
    actor: ActorEntity,
  ): AgentResult {
    return {
      actorId: actor.id,
      slug: actor.slug,
      name: actor.displayName,
      type: agent.type,
      description: agent.description,
      introduction: actor.introduction,
      avatarUrl: actor.avatarUrl,
      systemPrompt: agent.systemPrompt,
      providerId: agent.providerId ?? null,
      modelId: agent.modelId ?? null,
      statusTriggers: agent.statusTriggers,
      tagTriggers: agent.tagTriggers,
      allowedTools: agent.allowedTools,
      isActive: agent.isActive,
      concurrencyLimit: agent.concurrencyLimit,
      rowVersion: agent.rowVersion,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      deletedAt: agent.deletedAt ?? null,
    };
  }

  private normalizeOptionalId(value?: string | null): string | null {
    if (!value?.trim()) {
      return null;
    }
    return value;
  }
}
