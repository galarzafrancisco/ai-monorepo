import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskExecutionHistoryService } from './task-execution-history.service';
import { TaskExecutionHistoryEntity } from './task-execution-history.entity';
import { TaskExecutionHistoryStatus } from './task-execution-history-status.enum';
import { TaskExecutionHistoryErrorCode } from './task-execution-history-error-code.enum';

describe('TaskExecutionHistoryService', () => {
  let service: TaskExecutionHistoryService;
  let repository: jest.Mocked<Repository<TaskExecutionHistoryEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskExecutionHistoryService,
        {
          provide: getRepositoryToken(TaskExecutionHistoryEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TaskExecutionHistoryService>(
      TaskExecutionHistoryService,
    );
    repository = module.get(getRepositoryToken(TaskExecutionHistoryEntity));
  });

  describe('getLatestHistoryForTask', () => {
    it('should return the latest history entry for a task', async () => {
      const taskId = 'test-task-id';
      const mockHistory = {
        taskId,
        status: TaskExecutionHistoryStatus.SUCCEEDED,
        transitionedAt: new Date(),
      } as TaskExecutionHistoryEntity;

      repository.findOne.mockResolvedValue(mockHistory);

      const result = await service.getLatestHistoryForTask(taskId);

      expect(result).toBe(mockHistory);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { taskId },
        order: { transitionedAt: 'DESC' },
      });
    });

    it('should return null when no history exists', async () => {
      const taskId = 'test-task-id';

      repository.findOne.mockResolvedValue(null);

      const result = await service.getLatestHistoryForTask(taskId);

      expect(result).toBeNull();
    });
  });

  describe('countConsecutiveQuotaErrors', () => {
    const taskId = 'test-task-id';

    const createHistoryEntry = (
      status: TaskExecutionHistoryStatus,
      errorCode: TaskExecutionHistoryErrorCode | null,
      minutesAgo: number,
    ): TaskExecutionHistoryEntity => ({
      taskId,
      status,
      errorCode,
      transitionedAt: new Date(Date.now() - minutesAgo * 60 * 1000),
    } as TaskExecutionHistoryEntity);

    it('should count consecutive quota errors from most recent execution', async () => {
      const histories = [
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          1,
        ), // Most recent
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          2,
        ),
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          3,
        ),
        createHistoryEntry(
          TaskExecutionHistoryStatus.SUCCEEDED,
          null,
          4,
        ), // Non-quota execution - should stop counting here
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          5,
        ), // Should not be counted
      ];

      repository.find.mockResolvedValue(histories);

      const result = await service.countConsecutiveQuotaErrors(taskId);

      expect(result).toBe(3);
      expect(repository.find).toHaveBeenCalledWith({
        where: { taskId },
        order: { transitionedAt: 'DESC' },
      });
    });

    it('should return 0 when latest execution is not a quota error', async () => {
      const histories = [
        createHistoryEntry(
          TaskExecutionHistoryStatus.SUCCEEDED,
          null,
          1,
        ), // Most recent
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          2,
        ), // Should not be counted
      ];

      repository.find.mockResolvedValue(histories);

      const result = await service.countConsecutiveQuotaErrors(taskId);

      expect(result).toBe(0);
    });

    it('should return 0 when no history exists', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.countConsecutiveQuotaErrors(taskId);

      expect(result).toBe(0);
    });

    it('should count all quota errors if all executions are quota errors', async () => {
      const histories = [
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          1,
        ),
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          2,
        ),
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          3,
        ),
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          4,
        ),
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          5,
        ),
      ];

      repository.find.mockResolvedValue(histories);

      const result = await service.countConsecutiveQuotaErrors(taskId);

      expect(result).toBe(5);
    });

    it('should stop counting at first non-quota failure', async () => {
      const histories = [
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          1,
        ),
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          2,
        ),
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.UNKNOWN,
          3,
        ), // Different error - should stop here
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          4,
        ), // Should not be counted
      ];

      repository.find.mockResolvedValue(histories);

      const result = await service.countConsecutiveQuotaErrors(taskId);

      expect(result).toBe(2);
    });

    it('should stop counting at CANCELLED status', async () => {
      const histories = [
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          1,
        ),
        createHistoryEntry(
          TaskExecutionHistoryStatus.CANCELLED,
          null,
          2,
        ), // CANCELLED - should stop here
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          3,
        ), // Should not be counted
      ];

      repository.find.mockResolvedValue(histories);

      const result = await service.countConsecutiveQuotaErrors(taskId);

      expect(result).toBe(1);
    });

    it('should return 1 for single quota error', async () => {
      const histories = [
        createHistoryEntry(
          TaskExecutionHistoryStatus.FAILED,
          TaskExecutionHistoryErrorCode.OUT_OF_QUOTA,
          1,
        ),
      ];

      repository.find.mockResolvedValue(histories);

      const result = await service.countConsecutiveQuotaErrors(taskId);

      expect(result).toBe(1);
    });
  });
});
