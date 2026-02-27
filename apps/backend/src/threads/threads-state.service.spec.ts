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
import { TaskStatus } from '../tasks/enums';

describe('ThreadsService - State Context Block', () => {
  let service: ThreadsService;
  let threadRepository: jest.Mocked<Repository<ThreadEntity>>;
  let taskRepository: jest.Mocked<Repository<TaskEntity>>;
  let actorRepository: jest.Mocked<Repository<ActorEntity>>;
  let contextService: jest.Mocked<ContextService>;
  let metaService: jest.Mocked<MetaService>;

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

  const mockParentTask: TaskEntity = {
    id: 'parent-task-uuid',
    name: 'Parent Task',
    description: 'Parent task description',
    status: TaskStatus.NOT_STARTED,
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
            find: jest.fn(),
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
            delete: jest.fn(),
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
    contextService = module.get(ContextService);
    metaService = module.get(MetaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Thread Creation with State Block', () => {
    describe('1.1. Auto-creation of State Block', () => {
      it('should automatically create a state block when creating a thread', async () => {
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

        // Verify state block was created
        expect(contextService.createBlock).toHaveBeenCalledWith({
          title: expect.stringContaining('Thread State:'),
          content: expect.stringContaining('This thread was created to achieve task Parent Task'),
          createdByActorId: 'actor-uuid',
          parentId: null,
          tagNames: ['thread:state'],
        });

        // Verify thread has state block ID
        expect(threadRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            stateContextBlockId: 'state-block-uuid',
          }),
        );

        expect(result.stateContextBlockId).toBe('state-block-uuid');
      });
    });

    describe('1.2. State Block Initial Content', () => {
      it('should create state block with correct initial content format', async () => {
        const input: CreateThreadInput = {
          title: 'Authentication Implementation',
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

        await service.createThread(input);

        const createBlockCall = contextService.createBlock.mock.calls[0][0];
        expect(createBlockCall.content).toBe(
          'This thread was created to achieve task Parent Task (id parent-task-uuid).',
        );
      });
    });
  });

  describe('3. Get Thread State', () => {
    describe('3.1. Get State from Valid Thread', () => {
      it('should retrieve state content from an existing thread', async () => {
        threadRepository.findOne.mockResolvedValue(mockThread);
        contextService.getBlockById.mockResolvedValue(mockStateBlock);

        const result = await service.getThreadState('thread-uuid');

        expect(threadRepository.findOne).toHaveBeenCalledWith({
          where: { id: 'thread-uuid' },
        });
        expect(contextService.getBlockById).toHaveBeenCalledWith('state-block-uuid');
        expect(result).toBe(mockStateBlock.content);
      });
    });

    describe('3.2. Get State from Non-existent Thread', () => {
      it('should throw ThreadNotFoundError when thread does not exist', async () => {
        threadRepository.findOne.mockResolvedValue(null);

        await expect(service.getThreadState('non-existent-uuid')).rejects.toThrow(
          ThreadNotFoundError,
        );
        expect(contextService.getBlockById).not.toHaveBeenCalled();
      });
    });
  });

  describe('4. Update Thread State', () => {
    describe('4.1. Replace State Content', () => {
      it('should update the entire state content with new text', async () => {
        const newContent = 'Updated state with new decisions and context.';
        const updatedBlock = { ...mockStateBlock, content: newContent };

        threadRepository.findOne.mockResolvedValue(mockThread);
        contextService.updateBlock.mockResolvedValue(updatedBlock);

        const result = await service.updateThreadState('thread-uuid', newContent);

        expect(threadRepository.findOne).toHaveBeenCalledWith({
          where: { id: 'thread-uuid' },
        });
        expect(contextService.updateBlock).toHaveBeenCalledWith('state-block-uuid', {
          content: newContent,
        });
        expect(result).toBe(newContent);
      });
    });

    describe('4.3. Update State on Non-existent Thread', () => {
      it('should throw ThreadNotFoundError when thread does not exist', async () => {
        threadRepository.findOne.mockResolvedValue(null);

        await expect(
          service.updateThreadState('non-existent-uuid', 'new content'),
        ).rejects.toThrow(ThreadNotFoundError);
        expect(contextService.updateBlock).not.toHaveBeenCalled();
      });
    });
  });

  describe('5. Append to Thread State', () => {
    describe('5.1. Append New Content', () => {
      it('should append text to existing state', async () => {
        const appendContent = '\nDecision: Using JWT for authentication.';
        const updatedBlock = {
          ...mockStateBlock,
          content: mockStateBlock.content + appendContent,
        };

        threadRepository.findOne.mockResolvedValue(mockThread);
        contextService.appendToBlock.mockResolvedValue(updatedBlock);

        const result = await service.appendThreadState('thread-uuid', appendContent);

        expect(threadRepository.findOne).toHaveBeenCalledWith({
          where: { id: 'thread-uuid' },
        });
        expect(contextService.appendToBlock).toHaveBeenCalledWith('state-block-uuid', {
          content: appendContent,
        });
        expect(result).toContain(mockStateBlock.content);
        expect(result).toContain(appendContent);
      });
    });

    describe('5.2. Append Multiple Times', () => {
      it('should support multiple sequential appends to state', async () => {
        const append1 = '\nDecision 1: Using JWT.';
        const append2 = '\nDecision 2: Using PostgreSQL.';

        const afterAppend1 = {
          ...mockStateBlock,
          content: mockStateBlock.content + append1,
        };
        const afterAppend2 = {
          ...mockStateBlock,
          content: mockStateBlock.content + append1 + append2,
        };

        threadRepository.findOne.mockResolvedValue(mockThread);
        contextService.appendToBlock
          .mockResolvedValueOnce(afterAppend1)
          .mockResolvedValueOnce(afterAppend2);

        const result1 = await service.appendThreadState('thread-uuid', append1);
        const result2 = await service.appendThreadState('thread-uuid', append2);

        expect(result1).toContain(append1);
        expect(result2).toContain(append1);
        expect(result2).toContain(append2);
      });
    });

    describe('5.3. Append to Non-existent Thread', () => {
      it('should throw ThreadNotFoundError when thread does not exist', async () => {
        threadRepository.findOne.mockResolvedValue(null);

        await expect(
          service.appendThreadState('non-existent-uuid', 'content'),
        ).rejects.toThrow(ThreadNotFoundError);
        expect(contextService.appendToBlock).not.toHaveBeenCalled();
      });
    });
  });

  describe('6. Thread Response DTO', () => {
    describe('6.1. Thread DTO Includes stateContextBlockId', () => {
      it('should include stateContextBlockId in thread result', async () => {
        threadRepository.findOne.mockResolvedValue(mockThread);

        const result = await service.getThreadById('thread-uuid');

        expect(result.stateContextBlockId).toBe('state-block-uuid');
        expect(result.stateContextBlockId).toBeDefined();
      });
    });
  });

  describe('7. Thread Deletion with State Block', () => {
    describe('7.1. Thread Deletion Succeeds', () => {
      it('should delete thread successfully (state block remains)', async () => {
        threadRepository.findOne.mockResolvedValue(mockThread);
        threadRepository.softRemove.mockResolvedValue(mockThread);

        await service.deleteThread('thread-uuid', 'actor-uuid');

        expect(threadRepository.softRemove).toHaveBeenCalledWith(mockThread);
        // State block should NOT be deleted automatically
        expect(contextService.deleteBlock).not.toHaveBeenCalled();
      });
    });

    describe('7.2. Multiple Threads Cannot Share State Block', () => {
      it('should create different state blocks for different threads', async () => {
        const input1: CreateThreadInput = {
          title: 'Thread 1',
          createdByActorId: 'actor-uuid',
          parentTaskId: 'parent-task-uuid',
        };

        const input2: CreateThreadInput = {
          title: 'Thread 2',
          createdByActorId: 'actor-uuid',
          parentTaskId: 'parent-task-uuid',
        };

        const stateBlock1 = { ...mockStateBlock, id: 'state-block-1' };
        const stateBlock2 = { ...mockStateBlock, id: 'state-block-2' };
        const thread1 = {
          ...mockThread,
          id: 'thread-1',
          stateContextBlockId: 'state-block-1',
        };
        const thread2 = {
          ...mockThread,
          id: 'thread-2',
          stateContextBlockId: 'state-block-2',
        };

        actorRepository.findOne.mockResolvedValue(mockActor);
        taskRepository.findOne.mockResolvedValue(mockParentTask);
        taskRepository.findBy.mockResolvedValue([mockParentTask]);

        contextService.createBlock
          .mockResolvedValueOnce(stateBlock1)
          .mockResolvedValueOnce(stateBlock2);
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

        expect(result1.stateContextBlockId).toBe('state-block-1');
        expect(result2.stateContextBlockId).toBe('state-block-2');
        expect(result1.stateContextBlockId).not.toBe(result2.stateContextBlockId);
      });
    });
  });

  describe('8. Integration Tests', () => {
    describe('8.1. Complete State Management Flow', () => {
      it('should support full lifecycle: create → get → update → append → delete', async () => {
        const input: CreateThreadInput = {
          title: 'Full Lifecycle Thread',
          createdByActorId: 'actor-uuid',
          parentTaskId: 'parent-task-uuid',
        };

        // Create
        actorRepository.findOne.mockResolvedValue(mockActor);
        taskRepository.findOne.mockResolvedValue(mockParentTask);
        contextService.createBlock.mockResolvedValue(mockStateBlock);
        threadRepository.create.mockReturnValue(mockThread);
        threadRepository.save.mockResolvedValue(mockThread);
        taskRepository.findBy.mockResolvedValue([mockParentTask]);
        threadRepository.findOne.mockResolvedValue(mockThread);

        const thread = await service.createThread(input);
        expect(thread.stateContextBlockId).toBe('state-block-uuid');

        // Get state
        contextService.getBlockById.mockResolvedValue(mockStateBlock);
        const initialState = await service.getThreadState(thread.id);
        expect(initialState).toBe(mockStateBlock.content);

        // Update state
        const updatedContent = 'Completely new state.';
        const updatedBlock = { ...mockStateBlock, content: updatedContent };
        contextService.updateBlock.mockResolvedValue(updatedBlock);
        const afterUpdate = await service.updateThreadState(thread.id, updatedContent);
        expect(afterUpdate).toBe(updatedContent);

        // Append to state
        const appendContent = '\nAdditional info.';
        const appendedBlock = {
          ...mockStateBlock,
          content: updatedContent + appendContent,
        };
        contextService.appendToBlock.mockResolvedValue(appendedBlock);
        const afterAppend = await service.appendThreadState(thread.id, appendContent);
        expect(afterAppend).toContain(updatedContent);
        expect(afterAppend).toContain(appendContent);

        // Delete thread
        threadRepository.softRemove.mockResolvedValue(mockThread);
        await service.deleteThread(thread.id, 'actor-uuid');
        expect(threadRepository.softRemove).toHaveBeenCalled();
      });
    });
  });
});
