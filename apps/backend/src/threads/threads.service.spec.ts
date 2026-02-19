import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThreadsService } from './threads.service';
import { ThreadEntity } from './thread.entity';
import { TaskEntity } from '../tasks/task.entity';
import { ContextBlockEntity } from '../context/block.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { MetaService } from '../meta/meta.service';
import { ContextService } from '../context/context.service';
import {
  ThreadNotFoundError,
  TaskNotFoundForThreadError,
  ActorNotFoundForThreadError,
} from './errors/threads.errors';
import { CreateThreadInput } from './dto/service/threads.service.types';
import { ActorType } from '../identity-provider/enums';

describe('ThreadsService - Parent Task ID', () => {
  let service: ThreadsService;
  let threadRepository: jest.Mocked<Repository<ThreadEntity>>;
  let taskRepository: jest.Mocked<Repository<TaskEntity>>;
  let actorRepository: jest.Mocked<Repository<ActorEntity>>;
  let metaService: jest.Mocked<MetaService>;
  let contextService: jest.Mocked<ContextService>;

  const mockActor: ActorEntity = {
    id: 'actor-uuid',
    type: ActorType.HUMAN,
    slug: 'test-user',
    displayName: 'Test User',
    avatarUrl: null,
    introduction: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ActorEntity;

  const mockParentTask = {
    id: 'parent-task-uuid',
    name: 'Parent Task',
    description: 'Parent task description',
    status: 'NOT_STARTED',
    createdByActorId: 'actor-uuid',
    assigneeActorId: null,
    sessionId: null,
    tags: [],
    comments: [],
    artefacts: [],
    inputRequests: [],
    dependsOn: [],
    dependents: [],
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    get assignee() {
      return this.assigneeActor?.slug ?? null;
    },
  } as TaskEntity;

  const mockThread: ThreadEntity = {
    id: 'thread-uuid',
    title: 'Test Thread',
    chatSessionId: null,
    createdByActorId: 'actor-uuid',
    parentTaskId: 'parent-task-uuid',
    stateContextBlockId: 'state-block-uuid',
    tasks: [mockParentTask],
    referencedContextBlocks: [],
    tags: [],
    participants: [],
    createdByActor: mockActor,
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as ThreadEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreadsService,
        {
          provide: getRepositoryToken(ThreadEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findBy: jest.fn(),
            findAndCount: jest.fn(),
            softRemove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: {
            findOne: jest.fn(),
            findBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ContextBlockEntity),
          useValue: {
            findOne: jest.fn(),
            findBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ActorEntity),
          useValue: {
            findOne: jest.fn(),
            findBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AgentRunEntity),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: MetaService,
          useValue: {
            findOrCreateTagEntities: jest.fn(),
            findOrCreateTagEntity: jest.fn(),
            cleanupOrphanedTag: jest.fn(),
          },
        },
        {
          provide: ContextService,
          useValue: {
            createBlock: jest.fn(),
            getBlockById: jest.fn(),
            updateBlock: jest.fn(),
            appendToBlock: jest.fn(),
            deleteBlock: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ThreadsService>(ThreadsService);
    threadRepository = module.get(getRepositoryToken(ThreadEntity));
    taskRepository = module.get(getRepositoryToken(TaskEntity));
    actorRepository = module.get(getRepositoryToken(ActorEntity));
    metaService = module.get(MetaService);
    contextService = module.get(ContextService);
  });

  const mockStateBlock = {
    id: 'state-block-uuid',
    title: 'Thread State: Test Thread',
    content: 'This thread was created to achieve task Parent Task (id parent-task-uuid).',
    createdByActorId: 'actor-uuid',
    createdBy: 'test-user',
    assigneeActorId: null,
    assignee: null,
    parentId: null,
    order: 0,
    tags: [{ id: 'tag-uuid', name: 'thread:state', color: '#000000', createdAt: new Date(), updatedAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Thread Creation Tests', () => {
    describe('1.1. Successful Thread Creation with Parent Task', () => {
      it('should create a thread with a valid parent task ID', async () => {
        const input: CreateThreadInput = {
          title: 'Test Thread',
          createdByActorId: 'actor-uuid',
          parentTaskId: 'parent-task-uuid',
        };

        actorRepository.findOne.mockResolvedValue(mockActor);
        taskRepository.findOne.mockResolvedValue(mockParentTask);
        contextService.createBlock.mockResolvedValue(mockStateBlock);
        threadRepository.create.mockReturnValue(mockThread);
        threadRepository.save.mockResolvedValue(mockThread);
        taskRepository.findBy.mockResolvedValue([mockParentTask]);
        threadRepository.findOne.mockResolvedValue(mockThread);

        const result = await service.createThread(input);

        expect(result.parentTaskId).toBe('parent-task-uuid');
        expect(taskRepository.findOne).toHaveBeenCalledWith({
          where: { id: 'parent-task-uuid' },
        });
        expect(threadRepository.create).toHaveBeenCalledWith({
          title: 'Test Thread',
          chatSessionId: null,
          createdByActorId: 'actor-uuid',
          parentTaskId: 'parent-task-uuid',
          stateContextBlockId: 'state-block-uuid',
        });
      });
    });

    describe('1.3. Thread Creation Fails with Non-Existent Parent Task', () => {
      it('should throw TaskNotFoundForThreadError when parent task does not exist', async () => {
        const input: CreateThreadInput = {
          title: 'Test Thread',
          createdByActorId: 'actor-uuid',
          parentTaskId: 'non-existent-task-uuid',
        };

        actorRepository.findOne.mockResolvedValue(mockActor);
        taskRepository.findOne.mockResolvedValue(null);

        await expect(service.createThread(input)).rejects.toThrow(
          TaskNotFoundForThreadError,
        );
        expect(threadRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('1.4. Parent Task is Automatically Added to Thread\'s Tasks Relation', () => {
      it('should include parent task in tasks array even if not in taskIds', async () => {
        const input: CreateThreadInput = {
          title: 'Test Thread',
          createdByActorId: 'actor-uuid',
          parentTaskId: 'parent-task-uuid',
          taskIds: [], // Empty taskIds
        };

        actorRepository.findOne.mockResolvedValue(mockActor);
        taskRepository.findOne.mockResolvedValue(mockParentTask);
        contextService.createBlock.mockResolvedValue(mockStateBlock);
        threadRepository.create.mockReturnValue(mockThread);
        threadRepository.save.mockResolvedValue(mockThread);
        taskRepository.findBy.mockResolvedValue([mockParentTask]);
        threadRepository.findOne.mockResolvedValue(mockThread);

        await service.createThread(input);

        // Verify that taskRepository.findBy was called with parent task ID
        expect(taskRepository.findBy).toHaveBeenCalledWith({
          id: expect.anything(),
        });
        // The In clause should include parent task ID
        const callArg = taskRepository.findBy.mock.calls[0][0];
        expect(callArg).toBeDefined();
      });
    });

    describe('1.5. Parent Task Not Duplicated When Also in taskIds', () => {
      it('should not duplicate parent task when it is also in taskIds', async () => {
        const additionalTask = {
          ...mockParentTask,
          id: 'another-task-uuid',
          name: 'Another Task',
        } as TaskEntity;

        const input: CreateThreadInput = {
          title: 'Test Thread',
          createdByActorId: 'actor-uuid',
          parentTaskId: 'parent-task-uuid',
          taskIds: ['parent-task-uuid', 'another-task-uuid'], // Parent task included explicitly
        };

        actorRepository.findOne.mockResolvedValue(mockActor);
        taskRepository.findOne.mockResolvedValue(mockParentTask);
        contextService.createBlock.mockResolvedValue(mockStateBlock);
        threadRepository.create.mockReturnValue(mockThread);
        threadRepository.save.mockResolvedValue(mockThread);
        taskRepository.findBy.mockResolvedValue([
          mockParentTask,
          additionalTask,
        ]);
        threadRepository.findOne.mockResolvedValue({
          ...mockThread,
          tasks: [mockParentTask, additionalTask],
        });

        const result = await service.createThread(input);

        // Verify that the findBy was called with the correct number of unique IDs
        const findByCall = taskRepository.findBy.mock.calls[0][0];
        expect(findByCall).toBeDefined();

        // Result should contain both tasks
        expect(result.tasks.length).toBe(2);
      });
    });

    describe('Thread Creation with Non-Existent Creator', () => {
      it('should throw ActorNotFoundForThreadError when creator does not exist', async () => {
        const input: CreateThreadInput = {
          title: 'Test Thread',
          createdByActorId: 'non-existent-actor',
          parentTaskId: 'parent-task-uuid',
        };

        actorRepository.findOne.mockResolvedValue(null);

        await expect(service.createThread(input)).rejects.toThrow(
          ActorNotFoundForThreadError,
        );
        expect(taskRepository.findOne).not.toHaveBeenCalled();
      });
    });
  });

  describe('Thread Retrieval Tests', () => {
    describe('3.1. Get Thread Returns Correct parentTaskId', () => {
      it('should return thread with correct parentTaskId', async () => {
        threadRepository.findOne.mockResolvedValue(mockThread);

        const result = await service.getThreadById('thread-uuid');

        expect(result.parentTaskId).toBe('parent-task-uuid');
        expect(result.parentTaskId).not.toBeNull();
      });
    });

    describe('Get Thread by Non-Existent ID', () => {
      it('should throw ThreadNotFoundError when thread does not exist', async () => {
        threadRepository.findOne.mockResolvedValue(null);

        await expect(service.getThreadById('non-existent-uuid')).rejects.toThrow(
          ThreadNotFoundError,
        );
      });
    });

    describe('3.3. Find Thread by Task ID', () => {
      it('should find thread by parent task ID', async () => {
        const mockQueryBuilder = {
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(mockThread),
        };

        threadRepository.createQueryBuilder = jest
          .fn()
          .mockReturnValue(mockQueryBuilder);

        const result = await service.findThreadByTaskId('parent-task-uuid');

        expect(result).toBeDefined();
        expect(result?.parentTaskId).toBe('parent-task-uuid');
        expect(mockQueryBuilder.where).toHaveBeenCalledWith(
          'filterTask.id = :taskId',
          { taskId: 'parent-task-uuid' },
        );
      });

      it('should return null when thread is not found by task ID', async () => {
        const mockQueryBuilder = {
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        };

        threadRepository.createQueryBuilder = jest
          .fn()
          .mockReturnValue(mockQueryBuilder);

        const result = await service.findThreadByTaskId('non-existent-task-uuid');

        expect(result).toBeNull();
      });
    });
  });

  describe('Thread Deletion Tests', () => {
    describe('2.2. Can Delete Thread Without Affecting Parent Task', () => {
      it('should soft-delete thread successfully', async () => {
        threadRepository.findOne.mockResolvedValue(mockThread);
        threadRepository.softRemove.mockResolvedValue(mockThread);

        await service.deleteThread('thread-uuid', 'actor-uuid');

        expect(threadRepository.softRemove).toHaveBeenCalledWith(mockThread);
      });

      it('should throw ThreadNotFoundError when deleting non-existent thread', async () => {
        threadRepository.findOne.mockResolvedValue(null);

        await expect(
          service.deleteThread('non-existent-uuid', 'actor-uuid'),
        ).rejects.toThrow(ThreadNotFoundError);
        expect(threadRepository.softRemove).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    describe('5.1. Multiple Threads Can Share Same Parent Task', () => {
      it('should allow creating multiple threads with the same parent task', async () => {
        const input1: CreateThreadInput = {
          title: 'Thread 1',
          createdByActorId: 'actor-uuid',
          parentTaskId: 'parent-task-uuid',
        };

        const input2: CreateThreadInput = {
          title: 'Thread 2',
          createdByActorId: 'actor-uuid',
          parentTaskId: 'parent-task-uuid', // Same parent task
        };

        actorRepository.findOne.mockResolvedValue(mockActor);
        taskRepository.findOne.mockResolvedValue(mockParentTask);
        taskRepository.findBy.mockResolvedValue([mockParentTask]);
        contextService.createBlock.mockResolvedValue(mockStateBlock);

        const thread1 = { ...mockThread, id: 'thread-1-uuid', title: 'Thread 1' };
        const thread2 = { ...mockThread, id: 'thread-2-uuid', title: 'Thread 2' };

        threadRepository.create
          .mockReturnValueOnce(thread1)
          .mockReturnValueOnce(thread2);
        threadRepository.save
          .mockResolvedValueOnce(thread1)
          .mockResolvedValueOnce(thread2);
        threadRepository.findOne
          .mockResolvedValueOnce(thread1)
          .mockResolvedValueOnce(thread2);

        const result1 = await service.createThread(input1);
        const result2 = await service.createThread(input2);

        expect(result1.parentTaskId).toBe('parent-task-uuid');
        expect(result2.parentTaskId).toBe('parent-task-uuid');
        expect(result1.id).not.toBe(result2.id);
      });
    });

    describe('5.3. Attaching Additional Tasks Does Not Change Parent', () => {
      it('should not change parentTaskId when attaching new tasks', async () => {
        const newTask = {
          ...mockParentTask,
          id: 'new-task-uuid',
          name: 'New Task',
        } as TaskEntity;

        const threadWithTwoTasks = {
          ...mockThread,
          tasks: [mockParentTask, newTask],
        };

        threadRepository.findOne.mockResolvedValue(mockThread);
        taskRepository.findOne.mockResolvedValue(newTask);
        threadRepository.save.mockResolvedValue(threadWithTwoTasks);
        threadRepository.findOne.mockResolvedValueOnce(mockThread); // First call
        threadRepository.findOne.mockResolvedValueOnce(threadWithTwoTasks); // Second call after save
        threadRepository.findOne.mockResolvedValueOnce(threadWithTwoTasks); // Third call in attachTask

        const result = await service.attachTask('thread-uuid', 'new-task-uuid');

        expect(result.parentTaskId).toBe('parent-task-uuid'); // Should remain unchanged
        expect(result.tasks.length).toBe(2);
      });
    });
  });

  describe('Thread Update Tests', () => {
    it('should update thread title without changing parentTaskId', async () => {
      const updatedThread = { ...mockThread, title: 'Updated Title' };

      threadRepository.findOne
        .mockResolvedValueOnce(mockThread)
        .mockResolvedValueOnce(updatedThread);
      threadRepository.save.mockResolvedValue(updatedThread);

      const result = await service.updateThread(
        'thread-uuid',
        { title: 'Updated Title' },
        'actor-uuid',
      );

      expect(result.title).toBe('Updated Title');
      expect(result.parentTaskId).toBe('parent-task-uuid'); // Should remain unchanged
    });
  });

  describe('Thread Listing Tests', () => {
    it('should list threads with pagination', async () => {
      threadRepository.findAndCount.mockResolvedValue([[mockThread], 1]);

      const result = await service.listThreads({ page: 1, limit: 20 });

      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('findThreadsByStateBlockId', () => {
    it('should find threads by state block ID including soft-deleted', async () => {
      threadRepository.find.mockResolvedValue([mockThread]);

      const result = await service.findThreadsByStateBlockId('state-block-uuid');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('thread-uuid');
      expect(threadRepository.find).toHaveBeenCalledWith({
        where: { stateContextBlockId: 'state-block-uuid' },
        relations: expect.any(Array),
        withDeleted: true, // Verify that soft-deleted threads are included
      });
    });

    it('should return empty array when no threads use the state block', async () => {
      threadRepository.find.mockResolvedValue([]);

      const result = await service.findThreadsByStateBlockId('non-existent-state-block');

      expect(result.length).toBe(0);
      expect(threadRepository.find).toHaveBeenCalledWith({
        where: { stateContextBlockId: 'non-existent-state-block' },
        relations: expect.any(Array),
        withDeleted: true, // Verify that soft-deleted threads are included
      });
    });
  });
});
