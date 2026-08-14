import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEventEntity } from '../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../outbox/outbox-event-types';
import { AgentEntity } from './agent.entity';
import {
  AgentCreatedEvent,
  AgentDeletedEvent,
  AgentUpdatedEvent,
} from './events/agents.events';

@Injectable()
export class AgentOutboxProjectorService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(OutboxEventTypes.AGENT_CREATED)
  async projectCreated(event: OutboxEventEntity): Promise<void> {
    const agentId = event.payload.agentId;
    if (typeof agentId !== 'string' || agentId.length === 0) {
      throw new Error('Outbox agent event has invalid agentId');
    }
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
      relations: ['actor'],
    });
    if (!agent)
      throw new Error(`Outbox agent event references missing agent ${agentId}`);
    this.eventEmitter.emit('agent.created', new AgentCreatedEvent(agent));
  }

  @OnEvent(OutboxEventTypes.AGENT_UPDATED)
  async projectUpdated(event: OutboxEventEntity): Promise<void> {
    const agent = await this.loadAgent(event);
    this.eventEmitter.emit('agent.updated', new AgentUpdatedEvent(agent));
  }

  @OnEvent(OutboxEventTypes.AGENT_DELETED)
  projectDeleted(event: OutboxEventEntity): void {
    const actorId = event.payload.actorId;
    if (typeof actorId !== 'string' || actorId.length === 0) {
      throw new Error('Outbox agent deletion event has invalid actorId');
    }
    this.eventEmitter.emit('agent.deleted', new AgentDeletedEvent(actorId));
  }

  private async loadAgent(event: OutboxEventEntity): Promise<AgentEntity> {
    const agentId = event.payload.agentId;
    if (typeof agentId !== 'string' || agentId.length === 0) {
      throw new Error('Outbox agent event has invalid agentId');
    }
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
      relations: ['actor'],
    });
    if (!agent)
      throw new Error(`Outbox agent event references missing agent ${agentId}`);
    return agent;
  }
}
