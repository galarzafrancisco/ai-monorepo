import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from './agent.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import {
  CreateAgentInput,
  PatchAgentInput,
  AgentResult,
  ListAgentsInput,
  ListAgentsResult,
} from './dto/service/agents.service.types';
import {
  AgentNotFoundError,
  InvalidAgentAvatarUrlError,
} from './errors/agents.errors';
import { AGENT_TEMPLATE_CATALOG } from './agent-template.catalog';
import { AgentTemplateCatalogResponseDto } from './dto/agent-template-catalog-response.dto';
import {
  getDefaultAgentAvatarUrl,
  isManagedAgentAvatarUrl,
} from './agent-avatar.library';
import { CreateAgentUseCase } from './use-cases/create-agent.use-case';
import { PatchAgentUseCase } from './use-cases/patch-agent.use-case';
import { DeleteAgentUseCase } from './use-cases/delete-agent.use-case';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    private readonly createAgentUseCase: CreateAgentUseCase,
    private readonly patchAgentUseCase: PatchAgentUseCase,
    private readonly deleteAgentUseCase: DeleteAgentUseCase,
  ) {}

  async createAgent(input: CreateAgentInput): Promise<AgentResult> {
    this.logger.log(`Creating agent with slug: ${input.slug}`);

    // Create actor first
    let avatarUrl: string | null = null;
    if (input.avatarUrl !== undefined) {
      this.assertManagedAgentAvatarUrl(input.avatarUrl);
      avatarUrl = input.avatarUrl;
    } else {
      avatarUrl = getDefaultAgentAvatarUrl({
        type: input.type,
        providerId: input.providerId,
        modelId: input.modelId,
      });
    }
    const agentWithRelations = await this.createAgentUseCase.execute(
      input,
      avatarUrl,
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

  async deleteAgent(actorId: string): Promise<void> {
    this.logger.log(`Deleting agent with actorId: ${actorId}`);

    await this.deleteAgentUseCase.execute(actorId);
  }

  async patchAgent(
    actorId: string,
    input: PatchAgentInput,
  ): Promise<AgentResult> {
    this.logger.log(`Patching agent with actorId: ${actorId}`);

    if (input.avatarUrl !== undefined) {
      this.assertManagedAgentAvatarUrl(input.avatarUrl);
    }
    const agentWithRelations = await this.patchAgentUseCase.execute(
      actorId,
      input,
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

  private assertManagedAgentAvatarUrl(url: string | null | undefined): void {
    if (!isManagedAgentAvatarUrl(url)) {
      throw new InvalidAgentAvatarUrlError(url ?? '');
    }
  }
}
