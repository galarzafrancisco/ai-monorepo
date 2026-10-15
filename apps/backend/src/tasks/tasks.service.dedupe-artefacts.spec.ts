import { TasksService } from './tasks.service';
import { ArtefactEntity } from './artefact.entity';
import { IsNull } from 'typeorm';

describe('TasksService.addArtefact', () => {
  describe('deduplication', () => {
    it('returns existing artifact without creating a duplicate', async () => {
      const taskId = 'task-123';
      const actorId = 'actor-456';
      const artefactInput = {
        name: 'PR Link',
        link: 'https://github.com/example/pr/1077',
      };

      const existingArtefact: ArtefactEntity = {
        id: 'artefact-789',
        name: 'PR Link',
        link: 'https://github.com/example/pr/1077',
        taskId,
        task: { id: taskId } as any,
        rowVersion: 1,
        createdAt: new Date('2026-10-15'),
        updatedAt: new Date('2026-10-15'),
        deletedAt: null,
      };

      const mockTaskRepository = {
        findOne: jest.fn().mockResolvedValue({ id: taskId }),
      };

      const mockArtefactRepository = {
        findOne: jest
          .fn()
          .mockResolvedValue(existingArtefact),
        create: jest.fn(),
        save: jest.fn(),
      };

      const mockEventEmitter = {
        emit: jest.fn(),
      };

      const service = new TasksService(
        mockTaskRepository as any,
        mockArtefactRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockEventEmitter as any,
        {} as any,
        {} as any,
        {} as any,
      );

      // Mock the mapArtefactToResult method
      jest.spyOn(service, 'mapArtefactToResult' as any).mockReturnValue({
        id: existingArtefact.id,
        name: existingArtefact.name,
        link: existingArtefact.link,
      });

      const result = await service.addArtefact(taskId, artefactInput, actorId);

      // Verify the existing artifact was found
      expect(mockArtefactRepository.findOne).toHaveBeenCalledWith({
        where: {
          taskId,
          name: artefactInput.name,
          link: artefactInput.link,
          deletedAt: IsNull(),
        },
        relations: ['task'],
      });

      // Verify no new artifact was created
      expect(mockArtefactRepository.create).not.toHaveBeenCalled();
      expect(mockArtefactRepository.save).not.toHaveBeenCalled();

      // Verify no event was emitted
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();

      // Verify the result is the existing artifact
      expect(result.id).toBe(existingArtefact.id);
    });

    it('creates new artifact when no duplicate exists', async () => {
      const taskId = 'task-123';
      const actorId = 'actor-456';
      const artefactInput = {
        name: 'PR Link',
        link: 'https://github.com/example/pr/1077',
      };

      const newArtefact: ArtefactEntity = {
        id: 'artefact-new',
        name: 'PR Link',
        link: 'https://github.com/example/pr/1077',
        taskId,
        task: { id: taskId } as any,
        rowVersion: 1,
        createdAt: new Date('2026-10-15'),
        updatedAt: new Date('2026-10-15'),
        deletedAt: null,
      };

      const mockTaskRepository = {
        findOne: jest.fn().mockResolvedValue({ id: taskId }),
      };

      const mockArtefactRepository = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null) // First call: no existing artifact
          .mockResolvedValueOnce(newArtefact), // Second call: after save
        create: jest.fn().mockReturnValue(newArtefact),
        save: jest.fn().mockResolvedValue(newArtefact),
      };

      const mockEventEmitter = {
        emit: jest.fn(),
      };

      const service = new TasksService(
        mockTaskRepository as any,
        mockArtefactRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockEventEmitter as any,
        {} as any,
        {} as any,
        {} as any,
      );

      // Mock the mapArtefactToResult method
      jest.spyOn(service, 'mapArtefactToResult' as any).mockReturnValue({
        id: newArtefact.id,
        name: newArtefact.name,
        link: newArtefact.link,
      });

      const result = await service.addArtefact(taskId, artefactInput, actorId);

      // Verify the artifact was created
      expect(mockArtefactRepository.create).toHaveBeenCalled();
      expect(mockArtefactRepository.save).toHaveBeenCalled();

      // Verify the event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalled();

      // Verify the result is the new artifact
      expect(result.id).toBe(newArtefact.id);
    });

    it('allows creating new artifact with same name but different link', async () => {
      const taskId = 'task-123';
      const actorId = 'actor-456';
      const artefactInput = {
        name: 'PR Link',
        link: 'https://github.com/example/pr/1078', // Different link
      };

      const existingArtefact: ArtefactEntity = {
        id: 'artefact-789',
        name: 'PR Link',
        link: 'https://github.com/example/pr/1077', // Different link
        taskId,
        task: { id: taskId } as any,
        rowVersion: 1,
        createdAt: new Date('2026-10-15'),
        updatedAt: new Date('2026-10-15'),
        deletedAt: null,
      };

      const newArtefact: ArtefactEntity = {
        id: 'artefact-new',
        name: 'PR Link',
        link: 'https://github.com/example/pr/1078',
        taskId,
        task: { id: taskId } as any,
        rowVersion: 1,
        createdAt: new Date('2026-10-15'),
        updatedAt: new Date('2026-10-15'),
        deletedAt: null,
      };

      const mockTaskRepository = {
        findOne: jest.fn().mockResolvedValue({ id: taskId }),
      };

      const mockArtefactRepository = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null) // First call: no existing artifact with same name and link
          .mockResolvedValueOnce(newArtefact), // Second call: after save
        create: jest.fn().mockReturnValue(newArtefact),
        save: jest.fn().mockResolvedValue(newArtefact),
      };

      const mockEventEmitter = {
        emit: jest.fn(),
      };

      const service = new TasksService(
        mockTaskRepository as any,
        mockArtefactRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockEventEmitter as any,
        {} as any,
        {} as any,
        {} as any,
      );

      // Mock the mapArtefactToResult method
      jest.spyOn(service, 'mapArtefactToResult' as any).mockReturnValue({
        id: newArtefact.id,
        name: newArtefact.name,
        link: newArtefact.link,
      });

      const result = await service.addArtefact(taskId, artefactInput, actorId);

      // Verify the artifact was created
      expect(mockArtefactRepository.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalled();
      expect(result.id).toBe(newArtefact.id);
    });

    it('allows recreating artifact that was soft-deleted', async () => {
      const taskId = 'task-123';
      const actorId = 'actor-456';
      const artefactInput = {
        name: 'PR Link',
        link: 'https://github.com/example/pr/1077',
      };

      const softDeletedArtefact: ArtefactEntity = {
        id: 'artefact-789',
        name: 'PR Link',
        link: 'https://github.com/example/pr/1077',
        taskId,
        task: { id: taskId } as any,
        rowVersion: 1,
        createdAt: new Date('2026-10-15'),
        updatedAt: new Date('2026-10-15'),
        deletedAt: new Date('2026-10-15'),
      };

      const newArtefact: ArtefactEntity = {
        id: 'artefact-new',
        name: 'PR Link',
        link: 'https://github.com/example/pr/1077',
        taskId,
        task: { id: taskId } as any,
        rowVersion: 1,
        createdAt: new Date('2026-10-16'),
        updatedAt: new Date('2026-10-16'),
        deletedAt: null,
      };

      const mockTaskRepository = {
        findOne: jest.fn().mockResolvedValue({ id: taskId }),
      };

      const mockArtefactRepository = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null) // First call: no active (non-deleted) artifact
          .mockResolvedValueOnce(newArtefact), // Second call: after save
        create: jest.fn().mockReturnValue(newArtefact),
        save: jest.fn().mockResolvedValue(newArtefact),
      };

      const mockEventEmitter = {
        emit: jest.fn(),
      };

      const service = new TasksService(
        mockTaskRepository as any,
        mockArtefactRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockEventEmitter as any,
        {} as any,
        {} as any,
        {} as any,
      );

      // Mock the mapArtefactToResult method
      jest.spyOn(service, 'mapArtefactToResult' as any).mockReturnValue({
        id: newArtefact.id,
        name: newArtefact.name,
        link: newArtefact.link,
      });

      const result = await service.addArtefact(taskId, artefactInput, actorId);

      // Verify the new artifact was created (soft-deleted one is not considered)
      expect(mockArtefactRepository.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalled();
      expect(result.id).toBe(newArtefact.id);
    });
  });
});
