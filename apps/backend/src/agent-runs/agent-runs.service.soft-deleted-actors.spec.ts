jest.mock('@taico/errors', () => ({
  ErrorCodes: { AGENT_RUN_NOT_FOUND: 'AGENT_RUN_NOT_FOUND' },
}));

import { AgentRunsService } from './agent-runs.service';
import { ActorType } from '../identity-provider/enums';

describe('AgentRunsService soft-deleted actors', () => {
  it('preserves a deleted agent persona in legacy run history', async () => {
    const deletedAt = new Date('2026-09-14T08:00:00.000Z');
    const agentRunRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'run-1',
        actorId: 'deleted-agent-actor',
        actor: {
          id: 'deleted-agent-actor',
          type: ActorType.AGENT,
          slug: 'retired-agent',
          displayName: 'Retired Agent',
          avatarUrl: '/avatar/retired.svg',
          introduction: null,
          deletedAt,
        },
        parentTaskId: 'task-1',
        parentTask: { id: 'task-1', name: 'Historical task' },
        createdAt: deletedAt,
        startedAt: null,
        endedAt: deletedAt,
        lastPing: deletedAt,
        taskExecutionId: null,
      }),
    };
    const service = new AgentRunsService(agentRunRepository as any);

    const result = await service.getAgentRunById('run-1');

    expect(agentRunRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      relations: ['actor', 'parentTask'],
      withDeleted: true,
    });
    expect(result.actor).toMatchObject({
      id: 'deleted-agent-actor',
      displayName: 'Retired Agent',
      isDeactivated: true,
    });
  });
});
