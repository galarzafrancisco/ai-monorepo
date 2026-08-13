jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { AgentEntity } from '../agent.entity';
import { AgentType } from '../enums';
import { PatchAgentUseCase } from './patch-agent.use-case';

describe('PatchAgentUseCase', () => {
  it('updates the agent, its actor, and its durable event in one transaction', async () => {
    const actor = Object.assign(new ActorEntity(), {
      id: 'actor-1',
      slug: 'before',
      displayName: 'Before',
      avatarUrl: null,
      introduction: null,
    });
    const agent = Object.assign(new AgentEntity(), {
      id: 'agent-1',
      actorId: actor.id,
      actor,
      type: AgentType.OTHER,
      systemPrompt: 'before',
      isActive: true,
    });
    const actorRepository = Object.create(
      Repository.prototype,
    ) as Repository<ActorEntity>;
    const agentRepository = Object.create(
      Repository.prototype,
    ) as Repository<AgentEntity>;
    jest.spyOn(actorRepository, 'save').mockResolvedValue(actor);
    jest.spyOn(agentRepository, 'save').mockResolvedValue(agent);
    jest
      .spyOn(agentRepository, 'findOne')
      .mockResolvedValueOnce(agent)
      .mockResolvedValueOnce(agent);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: typeof ActorEntity | typeof AgentEntity) =>
        entity === ActorEntity ? actorRepository : agentRepository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    const transaction = jest.fn(
      async (
        callback: (transactionManager: EntityManager) => Promise<unknown>,
      ) => callback(manager),
    );
    Object.defineProperty(dataSource, 'transaction', { value: transaction });
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );
    const useCase = new PatchAgentUseCase(dataSource, outboxWriter);

    const result = await useCase.execute(actor.id, {
      name: 'After',
      slug: 'after',
      systemPrompt: 'after',
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result).toBe(agent);
    expect(actorRepository.save).toHaveBeenCalledWith(actor);
    expect(agentRepository.save).toHaveBeenCalledWith(agent);
    expect(agent.actor.displayName).toBe('After');
    expect(agent.actor.slug).toBe('after');
    expect(agent.systemPrompt).toBe('after');
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.AGENT_UPDATED,
        payload: { agentId: agent.id },
      }),
    );
  });
});
