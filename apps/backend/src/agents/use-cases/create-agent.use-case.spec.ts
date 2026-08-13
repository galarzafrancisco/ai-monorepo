jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { AgentEntity } from '../agent.entity';
import { AgentType } from '../enums';
import { CreateAgentUseCase } from './create-agent.use-case';

describe('CreateAgentUseCase', () => {
  it('persists the actor, agent, and creation event using one transaction manager', async () => {
    const actor = Object.assign(new ActorEntity(), {
      id: 'actor-1',
      slug: 'agent-one',
      displayName: 'Agent One',
    });
    const agent = Object.assign(new AgentEntity(), {
      id: 'agent-1',
      actorId: actor.id,
      actor,
      type: AgentType.OTHER,
    });
    const actorRepository = Object.create(
      Repository.prototype,
    ) as Repository<ActorEntity>;
    jest
      .spyOn(actorRepository, 'create')
      .mockImplementation((input) => Object.assign(new ActorEntity(), input));
    jest.spyOn(actorRepository, 'save').mockResolvedValue(actor);
    const agentRepository = Object.create(
      Repository.prototype,
    ) as Repository<AgentEntity>;
    jest
      .spyOn(agentRepository, 'create')
      .mockImplementation((input) => Object.assign(new AgentEntity(), input));
    jest.spyOn(agentRepository, 'save').mockResolvedValue(agent);
    jest.spyOn(agentRepository, 'findOne').mockResolvedValue(agent);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: typeof ActorEntity | typeof AgentEntity) =>
        entity === ActorEntity ? actorRepository : agentRepository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );
    const useCase = new CreateAgentUseCase(dataSource, outboxWriter);

    await useCase.execute(
      {
        slug: actor.slug,
        name: actor.displayName,
        type: AgentType.OTHER,
        systemPrompt: '',
        statusTriggers: [],
        allowedTools: [],
      },
      null,
    );

    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.AGENT_CREATED,
        payload: { agentId: agent.id },
      }),
    );
  });
});
