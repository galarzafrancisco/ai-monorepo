import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { WorkspaceMemberEntity } from '../workspaces/workspace-member.entity';
import { WorkspaceRole } from '../workspaces/enums';
import { AgentEntity } from './agent.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { buildDeletedActorSlug } from '../identity-provider/actor.service';
import {
  claimActorSlug,
  lockLiveActor,
} from '../identity-provider/actor-slug';
import { PROTECTED_AGENT_SLUGS } from './protected-agents';
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
  AgentDeletionNotAllowedError,
  AgentNotFoundError,
  AgentSlugConflictError,
  InvalidAgentAvatarUrlError,
} from './errors/agents.errors';
import {
  AgentCreatedEvent,
  AgentUpdatedEvent,
  AgentDeletedEvent,
} from './events/agents.events';
import { AGENT_TEMPLATE_CATALOG } from './agent-template.catalog';
import { AgentTemplateCatalogResponseDto } from './dto/agent-template-catalog-response.dto';
import {
  getDefaultAgentAvatarUrl,
  isManagedAgentAvatarUrl,
} from './agent-avatar.library';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates an agent in a workspace. The agent's actor is a member of that
   * workspace only (an agent never moves), and its slug must be free in it
   * (see `claimActorSlug`).
   */
  async createAgent(
    workspaceId: string,
    input: CreateAgentInput,
  ): Promise<AgentResult> {
    this.logger.log(`Creating agent with slug: ${input.slug}`);

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

    const savedAgentId = await this.agentRepository.manager.transaction(
      async (manager) => {
        await this.claimAgentSlug(manager, workspaceId, input.slug);

        const savedActor = await manager.save(
          ActorEntity,
          manager.create(ActorEntity, {
            type: ActorType.AGENT,
            slug: input.slug,
            displayName: input.name,
            avatarUrl: avatarUrl,
            introduction: input.introduction ?? null,
          }),
        );
        await this.setAgentMembership(manager, workspaceId, savedActor.id);

        const agent = manager.create(AgentEntity, {
          workspaceId,
          actorId: savedActor.id,
          type: input.type ?? AgentType.OTHER,
          description: input.description ?? null,
          systemPrompt: input.systemPrompt ?? '',
          followUpPrompt: input.followUpPrompt ?? null,
          providerId: this.normalizeOptionalId(input.providerId),
          modelId: this.normalizeOptionalId(input.modelId),
          statusTriggers: input.statusTriggers ?? [],
          tagTriggers: input.tagTriggers ?? [],
          allowedTools: input.allowedTools ?? [],
          isActive: input.isActive ?? true,
          concurrencyLimit: input.concurrencyLimit ?? null,
        });
        return (await manager.save(agent)).id;
      },
    );

    const agentWithRelations = await this.agentRepository.findOne({
      where: { workspaceId, id: savedAgentId },
      relations: ['actor'],
    });
    if (!agentWithRelations || !agentWithRelations.actor) {
      throw new AgentNotFoundError(savedAgentId);
    }

    this.eventEmitter.emit(
      'agent.created',
      new AgentCreatedEvent(agentWithRelations),
    );

    return this.mapAgentToResult(agentWithRelations, agentWithRelations.actor);
  }

  async listAgents(
    workspaceId: string,
    input: ListAgentsInput,
  ): Promise<ListAgentsResult> {
    this.logger.log(`Listing agents with filters: ${JSON.stringify(input)}`);

    const skip = (input.page - 1) * input.limit;

    const whereClause: Record<string, unknown> = { workspaceId };
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

  async listAllAgents(workspaceId: string): Promise<AgentResult[]> {
    const agents = await this.agentRepository.find({
      where: { workspaceId },
      relations: ['actor'],
    });

    return agents
      .filter((agent): agent is AgentEntity & { actor: ActorEntity } =>
        Boolean(agent.actor),
      )
      .map((agent) => this.mapAgentToResult(agent, agent.actor))
      .sort((left, right) => left.slug.localeCompare(right.slug));
  }

  getTemplateCatalog(): AgentTemplateCatalogResponseDto {
    return AGENT_TEMPLATE_CATALOG;
  }

  /** The agent with this slug in the workspace. Agent slugs are only unique per workspace. */
  async getAgentBySlug(
    workspaceId: string,
    { slug }: { slug: string },
  ): Promise<AgentResult> {
    this.logger.log(`Getting agent by slug: ${slug}`);

    const agent = await this.agentRepository
      .createQueryBuilder('agent')
      .innerJoinAndSelect('agent.actor', 'actor')
      .where('agent.workspaceId = :workspaceId', { workspaceId })
      .andWhere('actor.slug = :slug', { slug })
      .getOne();

    if (!agent) {
      throw new AgentNotFoundError(slug);
    }
    if (!agent.actor) {
      throw new AgentNotFoundError(slug);
    }

    return this.mapAgentToResult(agent, agent.actor);
  }

  async getActiveAgentsByActorIds(
    workspaceId: string,
    { actorIds }: { actorIds: string[] },
  ): Promise<AgentResult[]> {
    if (actorIds.length === 0) {
      return [];
    }

    const agents = await this.agentRepository.find({
      where: { workspaceId, actorId: In(actorIds), isActive: true },
      relations: ['actor'],
    });

    return agents
      .filter((agent): agent is AgentEntity & { actor: ActorEntity } =>
        Boolean(agent.actor),
      )
      .map((agent) => this.mapAgentToResult(agent, agent.actor));
  }

  async deleteAgent(workspaceId: string, actorId: string): Promise<void> {
    this.logger.log(`Deleting agent with actorId: ${actorId}`);

    // The actor row stays so tasks, comments and context it touched keep
    // resolving. It is marked deleted and gives its slug back. Both rows are
    // re-read and locked here, so a concurrent rename or patch can't be
    // undone or bring the slug back (see `lockLiveActor`).
    await this.agentRepository.manager.transaction(async (manager) => {
      const agent = await manager.findOne(AgentEntity, {
        where: { workspaceId, actorId },
        lock: { mode: 'pessimistic_write' },
      });
      const actor = agent ? await lockLiveActor(manager, actorId) : null;
      if (!agent || !actor) {
        throw new AgentNotFoundError(actorId);
      }
      if (PROTECTED_AGENT_SLUGS.includes(actor.slug)) {
        throw new AgentDeletionNotAllowedError(actor.slug);
      }
      await manager.softDelete(AgentEntity, { id: agent.id });
      await manager.update(
        ActorEntity,
        { id: actorId },
        { deletedAt: new Date(), slug: buildDeletedActorSlug(actor) },
      );
    });

    this.eventEmitter.emit(
      'agent.deleted',
      new AgentDeletedEvent(workspaceId, actorId),
    );
  }

  async patchAgent(
    workspaceId: string,
    actorId: string,
    input: PatchAgentInput,
  ): Promise<AgentResult> {
    this.logger.log(`Patching agent with actorId: ${actorId}`);

    // Only the requested columns are written, to rows re-read and locked in
    // the transaction (see `lockLiveActor`).
    const agentPatch: Partial<AgentEntity> = {};
    if (input.systemPrompt !== undefined) {
      agentPatch.systemPrompt = input.systemPrompt;
    }
    if (input.followUpPrompt !== undefined) {
      agentPatch.followUpPrompt = input.followUpPrompt;
    }
    if (input.providerId !== undefined) {
      agentPatch.providerId = this.normalizeOptionalId(input.providerId);
    }
    if (input.modelId !== undefined) {
      agentPatch.modelId = this.normalizeOptionalId(input.modelId);
    }
    if (input.statusTriggers !== undefined) {
      agentPatch.statusTriggers = input.statusTriggers;
    }
    if (input.tagTriggers !== undefined) {
      agentPatch.tagTriggers = input.tagTriggers;
    }
    if (input.type !== undefined) {
      agentPatch.type = input.type;
    }
    if (input.description !== undefined) {
      agentPatch.description = input.description;
    }
    if (input.allowedTools !== undefined) {
      agentPatch.allowedTools = input.allowedTools;
    }
    if (input.isActive !== undefined) {
      agentPatch.isActive = input.isActive;
    }
    if (input.concurrencyLimit !== undefined) {
      agentPatch.concurrencyLimit = input.concurrencyLimit;
    }

    const actorPatch: Partial<ActorEntity> = {};
    if (input.name !== undefined) {
      actorPatch.displayName = input.name;
    }
    if (input.slug !== undefined) {
      actorPatch.slug = input.slug;
    }
    if (input.introduction !== undefined) {
      actorPatch.introduction = input.introduction;
    }
    if (input.avatarUrl !== undefined) {
      this.assertManagedAgentAvatarUrl(input.avatarUrl);
      actorPatch.avatarUrl = input.avatarUrl;
    }

    const agentId = await this.agentRepository.manager.transaction(
      async (manager) => {
        const agent = await manager.findOne(AgentEntity, {
          where: { workspaceId, actorId },
          lock: { mode: 'pessimistic_write' },
        });
        const actor = agent ? await lockLiveActor(manager, actorId) : null;
        if (!agent || !actor) {
          throw new AgentNotFoundError(actorId);
        }

        if (actorPatch.slug !== undefined && actorPatch.slug !== actor.slug) {
          await this.claimAgentSlug(manager, workspaceId, actorPatch.slug, actorId);
        }
        if (Object.keys(actorPatch).length > 0) {
          await manager.update(ActorEntity, { id: actorId }, actorPatch);
        }
        if (Object.keys(agentPatch).length > 0) {
          await manager.update(AgentEntity, { id: agent.id }, agentPatch);
        }
        return agent.id;
      },
    );

    const agentWithRelations = await this.agentRepository.findOne({
      where: { workspaceId, id: agentId },
      relations: ['actor'],
    });
    if (!agentWithRelations || !agentWithRelations.actor) {
      throw new AgentNotFoundError(actorId);
    }

    this.eventEmitter.emit(
      'agent.updated',
      new AgentUpdatedEvent(agentWithRelations),
    );

    return this.mapAgentToResult(agentWithRelations, agentWithRelations.actor);
  }

  /** Claims an agent's slug in its workspace (see `claimActorSlug`). */
  private async claimAgentSlug(
    manager: EntityManager,
    workspaceId: string,
    slug: string,
    selfActorId?: string,
  ): Promise<void> {
    const free = await claimActorSlug(manager, {
      type: ActorType.AGENT,
      slug,
      workspaceId,
      selfActorId,
    });
    if (!free) {
      throw new AgentSlugConflictError(slug);
    }
  }

  /**
   * An agent is a member of exactly its own workspace. Actor inserts put
   * every new actor in the default workspace (`WorkspaceMembershipSubscriber`),
   * so the agent's membership is set here, in the same transaction.
   */
  private async setAgentMembership(
    manager: EntityManager,
    workspaceId: string,
    actorId: string,
  ): Promise<void> {
    await manager.delete(WorkspaceMemberEntity, {
      actorId,
      workspaceId: Not(workspaceId),
    });
    await manager
      .createQueryBuilder()
      .insert()
      .into(WorkspaceMemberEntity)
      .values({ workspaceId, actorId, role: WorkspaceRole.MEMBER })
      .orIgnore()
      .execute();
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
      followUpPrompt: agent.followUpPrompt ?? null,
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

  private assertManagedAgentAvatarUrl(url: string | null | undefined): void {
    if (!isManagedAgentAvatarUrl(url)) {
      throw new InvalidAgentAvatarUrlError(url ?? '');
    }
  }
}
