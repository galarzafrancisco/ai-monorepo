import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskExecutionQueuePopulatorService } from './task-execution-queue-populator.service';
import { TaskExecutionQueueEntity } from '../queue/task-execution-queue.entity';
import { TaskExecutionQueuedEvent } from '../queue/task-execution-queued.event';
import { AgentsService } from '../../agents/agents.service';
import { ReadinessCandidateRepository } from './readiness-candidate.repository';

describe('TaskExecutionQueuePopulatorService - Event Emission', () => {
  let service: TaskExecutionQueuePopulatorService;
  let queueRepository: jest.Mocked<Repository<TaskExecutionQueueEntity>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let agentsService: jest.Mocked<AgentsService>;
  let readinessCandidateRepository: jest.Mocked<ReadinessCandidateRepository>;

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
      ],
    }).compile();

    service = module.get<TaskExecutionQueuePopulatorService>(
      TaskExecutionQueuePopulatorService,
    );
    queueRepository = module.get(getRepositoryToken(TaskExecutionQueueEntity));
    eventEmitter = module.get(EventEmitter2);
    agentsService = module.get(AgentsService);
    readinessCandidateRepository = module.get(ReadinessCandidateRepository);
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
});
