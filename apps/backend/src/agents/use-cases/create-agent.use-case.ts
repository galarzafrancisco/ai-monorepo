import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { ActorType } from '../../identity-provider/enums';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { AgentEntity } from '../agent.entity';
import { AgentType } from '../enums';
import { CreateAgentInput } from '../dto/service/agents.service.types';
import {
  AgentNotFoundError,
  AgentSlugConflictError,
} from '../errors/agents.errors';

@Injectable()
export class CreateAgentUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    input: CreateAgentInput,
    avatarUrl: string | null,
  ): Promise<AgentEntity & { actor: ActorEntity }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const actorRepository = manager.getRepository(ActorEntity);
        const agentRepository = manager.getRepository(AgentEntity);
        const actor = await actorRepository.save(
          actorRepository.create({
            type: ActorType.AGENT,
            slug: input.slug,
            displayName: input.name,
            avatarUrl,
            introduction: input.introduction ?? null,
          }),
        );
        const agent = await agentRepository.save(
          agentRepository.create({
            actorId: actor.id,
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
          }),
        );
        const withActor = await agentRepository.findOne({
          where: { id: agent.id },
          relations: ['actor'],
        });
        this.requireActor(withActor, agent.id);
        await this.outboxWriter.enqueue(manager, {
          type: OutboxEventTypes.AGENT_CREATED,
          aggregateType: 'agent',
          aggregateId: agent.id,
          payload: { agentId: agent.id },
        });
        return withActor;
      });
    } catch (error) {
      if (this.isSlugConflict(error))
        throw new AgentSlugConflictError(input.slug);
      throw error;
    }
  }

  private normalizeOptionalId(value?: string | null): string | null {
    return value?.trim() ? value : null;
  }

  private requireActor(
    agent: AgentEntity | null,
    agentId: string,
  ): asserts agent is AgentEntity & { actor: ActorEntity } {
    if (!agent?.actor) throw new AgentNotFoundError(agentId);
  }

  private isSlugConflict(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
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
