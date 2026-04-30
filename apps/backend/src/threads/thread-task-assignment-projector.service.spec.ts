import { TaskAssignedEvent } from '../tasks/events/tasks.events';
import { ActorType } from '../identity-provider/enums';
import type { TaskEntity } from '../tasks/task.entity';
import type { ThreadResult } from './dto/service/threads.service.types';
import type { ThreadsService } from './threads.service';

jest.mock('./threads.service', () => ({
  ThreadsService: class ThreadsService {},
}));

import { ThreadTaskAssignmentProjectorService } from './thread-task-assignment-projector.service';

describe('ThreadTaskAssignmentProjectorService', () => {
  let service: ThreadTaskAssignmentProjectorService;
  let threadsService: jest.Mocked<Pick<ThreadsService, 'findThreadByTaskId' | 'addParticipant'>>;

  const assignedTask = {
    id: 'task-1',
    name: 'Assigned task',
    assigneeActorId: 'actor-2',
  } as TaskEntity;

  const thread = {
    id: 'thread-1',
    participants: [
      {
        id: 'actor-1',
        type: ActorType.HUMAN,
        slug: 'actor-1',
        displayName: 'Actor One',
        avatarUrl: null,
        introduction: null,
      },
    ],
  } as ThreadResult;

  beforeEach(() => {
    threadsService = {
      findThreadByTaskId: jest.fn(),
      addParticipant: jest.fn(),
    };

    service = new ThreadTaskAssignmentProjectorService(
      threadsService as unknown as ThreadsService,
    );
  });

  it('adds a newly assigned actor to the containing thread participants', async () => {
    threadsService.findThreadByTaskId.mockResolvedValue(thread);

    await service.onTaskAssigned(new TaskAssignedEvent({ id: 'actor-1' }, assignedTask));

    expect(threadsService.findThreadByTaskId).toHaveBeenCalledWith('task-1');
    expect(threadsService.addParticipant).toHaveBeenCalledWith('thread-1', 'actor-2');
  });

  it('does nothing when the assigned task is not in a thread', async () => {
    threadsService.findThreadByTaskId.mockResolvedValue(null);

    await service.onTaskAssigned(new TaskAssignedEvent({ id: 'actor-1' }, assignedTask));

    expect(threadsService.findThreadByTaskId).toHaveBeenCalledWith('task-1');
    expect(threadsService.addParticipant).not.toHaveBeenCalled();
  });

  it('does nothing when the assignee is already a thread participant', async () => {
    threadsService.findThreadByTaskId.mockResolvedValue({
      ...thread,
      participants: [
        ...thread.participants,
        {
          id: 'actor-2',
          type: ActorType.AGENT,
          slug: 'actor-2',
          displayName: 'Actor Two',
          avatarUrl: null,
          introduction: null,
        },
      ],
    });

    await service.onTaskAssigned(new TaskAssignedEvent({ id: 'actor-1' }, assignedTask));

    expect(threadsService.findThreadByTaskId).toHaveBeenCalledWith('task-1');
    expect(threadsService.addParticipant).not.toHaveBeenCalled();
  });
});
