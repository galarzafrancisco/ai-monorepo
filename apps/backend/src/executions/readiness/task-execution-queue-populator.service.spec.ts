import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskExecutionQueuePopulatorService } from './task-execution-queue-populator.service';
import { TaskExecutionQueueEntity } from '../queue/task-execution-queue.entity';
import { TaskExecutionQueuedEvent } from '../queue/task-execution-queued.event';
import { AgentsService } from '../../agents/agents.service';
import { ReadinessCandidateRepository } from './readiness-candidate.repository';
import { TaskExecutionHistoryService } from '../history/task-execution-history.service';
import { TaskExecutionHistoryStatus } from '../history/task-execution-history-status.enum';
import { TaskExecutionHistoryErrorCode } from '../history/task-execution-history-error-code.enum';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskStatus } from '../../tasks/enums/task-status.enum';

describe('TaskExecutionQueuePopulatorService - Event Emission', () => {
  let service: TaskExecutionQueuePopulatorService;
  let queueRepository: jest.Mocked<Repository<TaskExecutionQueueEntity>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let agentsService: jest.Mocked<AgentsService>;
  let readinessCandidateRepository: jest.Mocked<ReadinessCandidateRepository>;
  let taskExecutionHistoryService: jest.Mocked<TaskExecutionHistoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskExecutionQueuePopulatorService,
        {
          provide: getRepositoryToken(TaskExecutionQueueEntity),
          useValue: {
            createQueryBuilder: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
          },
        },
        {
          provide: AgentsService,
          useValue: {
            getActiveAgentsByActorIds: jest.fn(),
          },
        },
        {
          provide: ReadinessCandidateRepository,
          useValue: {
            findCandidateTaskById: jest.fn(),
            listCandidateTasks: jest.fn(),
            countActiveExecutionsForAgent: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: TaskExecutionHistoryService,
          useValue: {
            getLatestHistoryForTask: jest.fn(),
            countConsecutiveQuotaErrors: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TaskExecutionQueuePopulatorService>(
      TaskExecutionQueuePopulatorService,
    );
    queueRepository = module.get(getRepositoryToken(TaskExecutionQueueEntity));
    eventEmitter = module.get(EventEmitter2);
    agentsService = module.get(AgentsService);
    readinessCandidateRepository = module.get(ReadinessCandidateRepository);
    taskExecutionHistoryService = module.get(TaskExecutionHistoryService);
  });

  describe('upsertQueueEntry', () => {
    it('should emit TaskExecutionQueuedEvent when a new row is inserted (SQLite changes > 0)', async () => {
      const taskId = 'test-task-id';

      // Mock the query builder chain
      const executeResult = {
        raw: { changes: 1 }, // SQLite returns changes: 1 when a row is inserted
        identifiers: [{ taskId }],
      };

      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(executeResult),
      };

      queueRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      // Call the private method through reflection
      await (service as any).upsertQueueEntry(taskId);

      // Verify the event was emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        TaskExecutionQueuedEvent.INTERNAL,
        expect.objectContaining({
          taskId,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    });

    it('should NOT emit TaskExecutionQueuedEvent when insert is ignored (SQLite changes = 0)', async () => {
      const taskId = 'test-task-id';

      // Mock the query builder chain
      const executeResult = {
        raw: { changes: 0 }, // SQLite returns changes: 0 when insert is ignored due to duplicate
        identifiers: [],
      };

      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(executeResult),
      };

      queueRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      // Call the private method through reflection
      await (service as any).upsertQueueEntry(taskId);

      // Verify the event was NOT emitted
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should handle missing raw result gracefully', async () => {
      const taskId = 'test-task-id';

      // Mock the query builder chain with no raw result
      const executeResult = {
        identifiers: [],
      };

      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(executeResult),
      };

      queueRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      // Call the private method through reflection
      await (service as any).upsertQueueEntry(taskId);

      // Verify the event was NOT emitted
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('shouldQueueTask - Delay Retry Logic', () => {
    const createMockTask = (overrides: Partial<TaskEntity> = {}): TaskEntity => {
      return {
        id: 'test-task-id',
        name: 'Test Task',
        status: TaskStatus.NOT_STARTED,
        assigneeActorId: 'agent-actor-id',
        tags: [],
        ...overrides,
      } as TaskEntity;
    };

    const createMockAgent = (overrides = {}) => {
      return {
        actorId: 'agent-actor-id',
        slug: 'test-agent',
        statusTriggers: [TaskStatus.NOT_STARTED],
        tagTriggers: [],
        concurrencyLimit: null,
        ...overrides,
      } as any;
    };

    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks();

      // Default mock implementations
      agentsService.getActiveAgentsByActorIds.mockResolvedValue([
        createMockAgent(),
      ]);
      readinessCandidateRepository.countActiveExecutionsForAgent.mockResolvedValue(
        0,
      );
      taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue(
        null,
      );
      taskExecutionHistoryService.countConsecutiveQuotaErrors.mockResolvedValue(
        0,
      );
    });

    describe('CANCELLED delay', () => {
      it('should NOT queue task when cancelled less than 10 minutes ago', async () => {
        const task = createMockTask();
        const cancelledAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.CANCELLED,
          errorCode: null,
          transitionedAt: cancelledAt,
        } as any);

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(false);
        expect(
          taskExecutionHistoryService.getLatestHistoryForTask,
        ).toHaveBeenCalledWith(task.id);
      });

      it('should queue task when cancelled 10 minutes ago or more', async () => {
        const task = createMockTask();
        const cancelledAt = new Date(Date.now() - 10 * 60 * 1000); // exactly 10 minutes ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.CANCELLED,
          errorCode: null,
          transitionedAt: cancelledAt,
        } as any);

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(true);
      });

      it('should queue task when cancelled more than 10 minutes ago', async () => {
        const task = createMockTask();
        const cancelledAt = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.CANCELLED,
          errorCode: null,
          transitionedAt: cancelledAt,
        } as any);

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(true);
      });
    });

    describe('OUT_OF_QUOTA delay', () => {
      it('should NOT queue task with 1 quota error less than 10 minutes ago', async () => {
        const task = createMockTask();
        const errorAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.FAILED,
          errorCode: TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          transitionedAt: errorAt,
        } as any);
        taskExecutionHistoryService.countConsecutiveQuotaErrors.mockResolvedValue(
          1,
        );

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(false);
        expect(
          taskExecutionHistoryService.countConsecutiveQuotaErrors,
        ).toHaveBeenCalledWith(task.id);
      });

      it('should queue task with 1 quota error 10 minutes ago or more', async () => {
        const task = createMockTask();
        const errorAt = new Date(Date.now() - 10 * 60 * 1000); // exactly 10 minutes ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.FAILED,
          errorCode: TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          transitionedAt: errorAt,
        } as any);
        taskExecutionHistoryService.countConsecutiveQuotaErrors.mockResolvedValue(
          1,
        );

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(true);
      });

      it('should NOT queue task with 3 quota errors less than 30 minutes ago', async () => {
        const task = createMockTask();
        const errorAt = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.FAILED,
          errorCode: TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          transitionedAt: errorAt,
        } as any);
        taskExecutionHistoryService.countConsecutiveQuotaErrors.mockResolvedValue(
          3,
        ); // 3 * 10 = 30 minutes

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(false);
      });

      it('should queue task with 3 quota errors 30 minutes ago or more', async () => {
        const task = createMockTask();
        const errorAt = new Date(Date.now() - 30 * 60 * 1000); // exactly 30 minutes ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.FAILED,
          errorCode: TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          transitionedAt: errorAt,
        } as any);
        taskExecutionHistoryService.countConsecutiveQuotaErrors.mockResolvedValue(
          3,
        );

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(true);
      });

      it('should cap delay at 1 hour for many consecutive quota errors', async () => {
        const task = createMockTask();
        const errorAt = new Date(Date.now() - 50 * 60 * 1000); // 50 minutes ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.FAILED,
          errorCode: TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          transitionedAt: errorAt,
        } as any);
        taskExecutionHistoryService.countConsecutiveQuotaErrors.mockResolvedValue(
          10,
        ); // 10 * 10 = 100 minutes, capped at 60

        const result = await (service as any).shouldQueueTask(task);

        // Should not queue because 50 minutes < 60 minutes (max cap)
        expect(result).toBe(false);
      });

      it('should queue task with many consecutive quota errors after 1 hour', async () => {
        const task = createMockTask();
        const errorAt = new Date(Date.now() - 60 * 60 * 1000); // exactly 60 minutes ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.FAILED,
          errorCode: TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          transitionedAt: errorAt,
        } as any);
        taskExecutionHistoryService.countConsecutiveQuotaErrors.mockResolvedValue(
          10,
        ); // Would be 100 minutes but capped at 60

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(true);
      });
    });

    describe('Non-delay scenarios', () => {
      it('should queue task with no execution history', async () => {
        const task = createMockTask();

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue(
          null,
        );

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(true);
      });

      it('should queue task with SUCCEEDED latest history', async () => {
        const task = createMockTask();
        const successAt = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.SUCCEEDED,
          errorCode: null,
          transitionedAt: successAt,
        } as any);

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(true);
      });

      it('should queue task with FAILED latest history (non-quota error)', async () => {
        const task = createMockTask();
        const failedAt = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago

        taskExecutionHistoryService.getLatestHistoryForTask.mockResolvedValue({
          taskId: task.id,
          status: TaskExecutionHistoryStatus.FAILED,
          errorCode: TaskExecutionHistoryErrorCode.UNKNOWN,
          transitionedAt: failedAt,
        } as any);

        const result = await (service as any).shouldQueueTask(task);

        expect(result).toBe(true);
      });
    });
  });
});
