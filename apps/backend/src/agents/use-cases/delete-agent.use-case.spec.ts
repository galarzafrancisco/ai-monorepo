jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { AgentEntity } from '../agent.entity';
import { DeleteAgentUseCase } from './delete-agent.use-case';

describe('DeleteAgentUseCase', () => {
  it('soft deletes the agent and records the deletion in the same transaction', async () => {
    const agent = Object.assign(new AgentEntity(), {
      id: 'agent-1',
      actorId: 'actor-1',
    });
    const agentRepository = Object.create(
      Repository.prototype,
    ) as Repository<AgentEntity>;
    jest.spyOn(agentRepository, 'findOne').mockResolvedValue(agent);
    jest.spyOn(agentRepository, 'softRemove').mockResolvedValue(agent);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: () => agentRepository,
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
    const useCase = new DeleteAgentUseCase(dataSource, outboxWriter);

    await useCase.execute(agent.actorId);

    expect(agentRepository.softRemove).toHaveBeenCalledWith(agent);
    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.AGENT_DELETED,
        aggregateId: agent.id,
        actorId: agent.actorId,
        payload: { actorId: agent.actorId, agentId: agent.id },
      }),
    );
  });
});
