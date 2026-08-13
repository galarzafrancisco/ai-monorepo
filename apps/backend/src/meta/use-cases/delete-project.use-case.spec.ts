jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProjectEntity } from '../project.entity';
import { TransactionalTagWriterService } from '../transactional-tag-writer.service';
import { DeleteProjectUseCase } from './delete-project.use-case';

describe('DeleteProjectUseCase', () => {
  it('soft deletes a project and cleans up its unreferenced tag in one transaction', async () => {
    const project = Object.assign(new ProjectEntity(), {
      id: 'project-1',
      tagId: 'tag-1',
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<ProjectEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(project);
    jest.spyOn(repository, 'softRemove').mockResolvedValue(project);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: () => repository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const tagWriter = Object.create(
      TransactionalTagWriterService.prototype,
    ) as TransactionalTagWriterService;
    const cleanup = jest
      .spyOn(tagWriter, 'cleanupOrphaned')
      .mockResolvedValue();
    const useCase = new DeleteProjectUseCase(dataSource, tagWriter);

    await expect(useCase.execute(project.id)).resolves.toBe(true);

    expect(repository.softRemove).toHaveBeenCalledWith(project);
    expect(cleanup).toHaveBeenCalledWith(manager, project.tagId);
  });
});
