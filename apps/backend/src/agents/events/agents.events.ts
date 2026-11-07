import { AgentEntity } from '../agent.entity';

export class AgentCreatedEvent {
  constructor(public readonly agent: AgentEntity) {}
}

export class AgentUpdatedEvent {
  constructor(public readonly agent: AgentEntity) {}
}

export class AgentDeletedEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly agentId: string,
  ) {}
}
