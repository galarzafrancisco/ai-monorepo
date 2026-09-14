jest.mock('@taico/errors', () => ({
  ErrorCodes: {},
}));

jest.mock('../threads/chat.service', () => ({
  ChatService: jest.fn(),
}));

import { TaskBlueprintsService } from './task-blueprints.service';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { TaskSchedulerService } from './task-scheduler.service';
import { ActorType } from '../identity-provider/enums';
import { IsNull } from 'typeorm';

describe('task blueprint soft-deleted actors', () => {
  const deletedAt = new Date('2026-09-14T08:00:00.000Z');
  const actor = {
    id: 'deleted-agent-actor',
    type: ActorType.AGENT,
    slug: 'retired-agent',
    displayName: 'Retired Agent',
    avatarUrl: '/avatar/retired.svg',
    introduction: null,
    deletedAt,
  };

  it('keeps the deleted creator persona when reading a blueprint', async () => {
    const blueprintRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'blueprint-1',
        name: 'Blueprint',
        description: '',
        assigneeActorId: null,
        assigneeActor: null,
        createdByActor: actor,
        tags: [],
        dependsOnIds: [],
        rowVersion: 1,
        createdAt: deletedAt,
        updatedAt: deletedAt,
        deletedAt: null,
      }),
    };
    const service = new TaskBlueprintsService(
      blueprintRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getTaskBlueprintById('blueprint-1');

    expect(blueprintRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ withDeleted: true }),
    );
    expect(result.createdByActor).toMatchObject({
      id: actor.id,
      isDeactivated: true,
    });
  });

  it('keeps deleted blueprint actor personas when reading a schedule', async () => {
    const scheduledTaskRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'schedule-1',
        taskBlueprintId: 'blueprint-1',
        taskBlueprint: {
          id: 'blueprint-1',
          name: 'Blueprint',
          description: '',
          assigneeActorId: null,
          assigneeActor: null,
          createdByActor: actor,
          tags: [],
          dependsOnIds: [],
          rowVersion: 1,
          createdAt: deletedAt,
          updatedAt: deletedAt,
          deletedAt: null,
        },
        cronExpression: '* * * * *',
        enabled: true,
        lastRunAt: null,
        nextRunAt: deletedAt,
        rowVersion: 1,
        createdAt: deletedAt,
        updatedAt: deletedAt,
        deletedAt: null,
      }),
    };
    const taskBlueprintsService = {
      mapBlueprintToResult: jest.fn().mockReturnValue({
        id: 'blueprint-1',
        createdByActor: { id: actor.id, isDeactivated: true },
      }),
    };
    const service = new ScheduledTasksService(
      scheduledTaskRepository as any,
      {} as any,
      taskBlueprintsService as any,
    );

    const result = await service.getScheduledTaskById('schedule-1');

    expect(scheduledTaskRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ withDeleted: true }),
    );
    expect(result.taskBlueprint?.createdByActor).toMatchObject({
      id: actor.id,
      isDeactivated: true,
    });
  });

  it('excludes deleted schedules from due execution while retaining actors', async () => {
    const scheduledTaskRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new ScheduledTasksService(
      scheduledTaskRepository as any,
      {} as any,
      {} as any,
    );

    await service.getDueScheduledTasks();

    expect(scheduledTaskRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        withDeleted: true,
        where: expect.objectContaining({
          enabled: true,
          deletedAt: IsNull(),
        }),
      }),
    );
  });

  it('does not claim a schedule deleted after due-task listing', async () => {
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const scheduledTaskRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const service = new ScheduledTasksService(
      scheduledTaskRepository as any,
      {} as any,
      {} as any,
    );

    const result = await service.claimDueTaskExecution(
      'schedule-1',
      deletedAt,
      '* * * * *',
    );

    expect(result).toBeNull();
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('deleted_at IS NULL');
  });

  it('keeps running a schedule owned by a deleted agent', async () => {
    const scheduledTasksService = {
      getDueScheduledTasks: jest.fn().mockResolvedValue([
        {
          id: 'schedule-1',
          taskBlueprintId: 'blueprint-1',
          nextRunAt: deletedAt,
          cronExpression: '* * * * *',
        },
      ]),
      claimDueTaskExecution: jest.fn().mockResolvedValue(deletedAt),
      completeClaimedExecution: jest.fn(),
      rollbackExecutionClaim: jest.fn(),
    };
    const taskBlueprintsService = {
      createTaskFromBlueprint: jest.fn().mockResolvedValue({ id: 'task-1' }),
    };
    const service = new TaskSchedulerService(
      scheduledTasksService as any,
      taskBlueprintsService as any,
    );

    await service.handleScheduledTasks();

    expect(taskBlueprintsService.createTaskFromBlueprint).toHaveBeenCalledWith(
      'blueprint-1',
    );
    expect(scheduledTasksService.completeClaimedExecution).toHaveBeenCalledWith(
      'schedule-1',
    );
    expect(scheduledTasksService.rollbackExecutionClaim).not.toHaveBeenCalled();
  });

  it('creates blueprint tasks with their deleted creator allowed', async () => {
    const tasksService = {
      createTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
    };
    const service = new TaskBlueprintsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      tasksService as any,
      {} as any,
    );
    jest.spyOn(service, 'getTaskBlueprintById').mockResolvedValue({
      id: 'blueprint-1',
      name: 'Blueprint',
      description: '',
      assigneeActorId: null,
      tags: [],
      dependsOnIds: [],
      createdByActor: actor,
    } as any);

    await service.createTaskFromBlueprint('blueprint-1');

    expect(tasksService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByActorId: actor.id,
        allowDeletedCreator: true,
      }),
    );
  });
});
