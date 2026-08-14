import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { AgentEntity } from '../agent.entity';
import { PatchAgentInput } from '../dto/service/agents.service.types';
import {
  AgentNotFoundError,
  AgentSlugConflictError,
} from '../errors/agents.errors';

@Injectable()
export class PatchAgentUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    actorId: string,
    input: PatchAgentInput,
  ): Promise<AgentEntity & { actor: ActorEntity }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const agentRepository = manager.getRepository(AgentEntity);
        const actorRepository = manager.getRepository(ActorEntity);
        const agent = await agentRepository.findOne({
          where: { actorId },
          relations: ['actor'],
        });
        this.requireActor(agent, actorId);
        this.applyAgentChanges(agent, input);
        this.applyActorChanges(agent.actor, input);
        if (this.isActorUpdateRequested(input))
          await actorRepository.save(agent.actor);
        await agentRepository.save(agent);
        const updated = await agentRepository.findOne({
          where: { id: agent.id },
          relations: ['actor'],
        });
        this.requireActor(updated, agent.id);
        await this.outboxWriter.enqueue(manager, {
          type: OutboxEventTypes.AGENT_UPDATED,
          aggregateType: 'agent',
          aggregateId: updated.id,
          payload: { agentId: updated.id },
        });
        return updated;
      });
    } catch (error) {
      if (input.slug && this.isSlugConflict(error, input.slug)) {
        throw new AgentSlugConflictError(input.slug);
      }
      throw error;
    }
  }

  private applyAgentChanges(agent: AgentEntity, input: PatchAgentInput): void {
    if (input.systemPrompt !== undefined)
      agent.systemPrompt = input.systemPrompt;
    if (input.providerId !== undefined)
      agent.providerId = this.normalize(input.providerId);
    if (input.modelId !== undefined)
      agent.modelId = this.normalize(input.modelId);
    if (input.statusTriggers !== undefined)
      agent.statusTriggers = input.statusTriggers;
    if (input.tagTriggers !== undefined) agent.tagTriggers = input.tagTriggers;
    if (input.type !== undefined) agent.type = input.type;
    if (input.description !== undefined) agent.description = input.description;
    if (input.allowedTools !== undefined)
      agent.allowedTools = input.allowedTools;
    if (input.isActive !== undefined) agent.isActive = input.isActive;
    if (input.concurrencyLimit !== undefined)
      agent.concurrencyLimit = input.concurrencyLimit;
  }

  private applyActorChanges(actor: ActorEntity, input: PatchAgentInput): void {
    if (input.name !== undefined) actor.displayName = input.name;
    if (input.slug !== undefined) actor.slug = input.slug;
    if (input.introduction !== undefined)
      actor.introduction = input.introduction;
    if (input.avatarUrl !== undefined) actor.avatarUrl = input.avatarUrl;
  }

  private isActorUpdateRequested(input: PatchAgentInput): boolean {
    return (
      input.name !== undefined ||
      input.slug !== undefined ||
      input.introduction !== undefined ||
      input.avatarUrl !== undefined
    );
  }

  private normalize(value?: string | null): string | null {
    return value?.trim() ? value : null;
  }

  private requireActor(
    agent: AgentEntity | null,
    agentId: string,
  ): asserts agent is AgentEntity & { actor: ActorEntity } {
    if (!agent?.actor) throw new AgentNotFoundError(agentId);
  }

  private isSlugConflict(error: unknown, slug?: string): boolean {
    if (!slug || !(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as {
      code?: string;
      message?: string;
    };
    return (
      driverError?.code === 'SQLITE_CONSTRAINT' &&
      Boolean(driverError.message?.includes('actor.slug'))
    );
  }
}
