jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProjectEntity } from '../project.entity';
import { TagEntity } from '../tag.entity';
import { CreateProjectUseCase } from './create-project.use-case';

describe('CreateProjectUseCase', () => {
  it('creates the project tag and project using one transaction manager', async () => {
    const tag = Object.assign(new TagEntity(), {
      id: 'tag-1',
      name: 'project:demo',
    });
    const project = Object.assign(new ProjectEntity(), {
      id: 'project-1',
      tagId: tag.id,
      slug: 'demo',
    });
    const tagRepository = Object.create(
      Repository.prototype,
    ) as Repository<TagEntity>;
    jest.spyOn(tagRepository, 'findOne').mockResolvedValue(null);
    jest
      .spyOn(tagRepository, 'create')
      .mockImplementation((input) => Object.assign(new TagEntity(), input));
    jest.spyOn(tagRepository, 'save').mockResolvedValue(tag);
    const projectRepository = Object.create(
      Repository.prototype,
    ) as Repository<ProjectEntity>;
    jest.spyOn(projectRepository, 'findOne').mockResolvedValue(null);
    jest
      .spyOn(projectRepository, 'create')
      .mockImplementation((input) => Object.assign(new ProjectEntity(), input));
    jest.spyOn(projectRepository, 'save').mockResolvedValue(project);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: unknown) =>
        entity === TagEntity ? tagRepository : projectRepository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const useCase = new CreateProjectUseCase(dataSource);

    const result = await useCase.execute({ slug: project.slug });

    expect(tagRepository.save).toHaveBeenCalledWith(expect.any(TagEntity));
    expect(projectRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ tagId: tag.id }),
    );
    expect(result.tag).toBe(tag);
  });
});
