import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { AgentEntity } from '../agent.entity';
import { AgentNotFoundError } from '../errors/agents.errors';

@Injectable()
export class DeleteAgentUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(actorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const agentRepository = manager.getRepository(AgentEntity);
      const agent = await agentRepository.findOne({ where: { actorId } });
      if (!agent) throw new AgentNotFoundError(actorId);

      await agentRepository.softRemove(agent);
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.AGENT_DELETED,
        aggregateType: 'agent',
        aggregateId: agent.id,
        actorId,
        payload: { actorId, agentId: agent.id },
      });
    });
  }
}
