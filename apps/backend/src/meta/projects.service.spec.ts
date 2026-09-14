import { BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

describe('ProjectsService import/export', () => {
  const createdAt = new Date('2026-01-01T00:00:00Z');
  const updatedAt = new Date('2026-01-02T00:00:00Z');

  function createService() {
    const projectRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((project) => project),
      save: jest.fn(async (project) => ({
        id: `${project.slug}-id`,
        createdAt,
        updatedAt,
        ...project,
      })),
      softDelete: jest.fn(),
    };
    const metaService = {
      findOrCreateTagEntity: jest.fn(async (name: string, color?: string) => ({
        id: `${name}-tag-id`,
        name,
        color,
      })),
      deleteTag: jest.fn(),
    };
    const searchService = {
      search: jest.fn(),
    };

    const service = new ProjectsService(
      projectRepository as any,
      metaService as any,
      searchService as any,
    );

    return { service, projectRepository, metaService };
  }

  it('exports projects as JSON without database identifiers', async () => {
    const { service, projectRepository } = createService();
    projectRepository.find.mockResolvedValue([
      {
        id: 'project-1',
        tagId: 'tag-1',
        tag: { name: 'project:taico', color: '#98D8C8' },
        slug: 'taico',
        description: 'AI task management',
        repoUrl: 'https://github.com/example/taico',
        createdAt,
        updatedAt,
      },
    ]);

    const file = await service.exportProjectsAsJson();
    const payload = JSON.parse(file.toString('utf8'));

    expect(payload).toMatchObject({
      version: 1,
      projects: [
        {
          slug: 'taico',
          description: 'AI task management',
          repoUrl: 'https://github.com/example/taico',
          color: '#98D8C8',
        },
      ],
    });
    expect(payload.projects[0]).not.toHaveProperty('id');
    expect(payload.projects[0]).not.toHaveProperty('tagId');
  });

  it('imports projects using the normal create project flow', async () => {
    const { service, projectRepository, metaService } = createService();
    projectRepository.findOne.mockResolvedValue(null);
    const file = Buffer.from(
      JSON.stringify({
        version: 1,
        projects: [
          {
            slug: 'taico',
            description: 'AI task management',
            color: '#98D8C8',
          },
          { slug: 'worker', repoUrl: 'git@github.com:example/worker.git' },
        ],
      }),
    );

    const result = await service.importProjectsFromJson(file);

    expect(result).toEqual({ importedCount: 2 });
    expect(metaService.findOrCreateTagEntity).toHaveBeenCalledWith(
      'project:taico',
      '#98D8C8',
    );
    expect(metaService.findOrCreateTagEntity).toHaveBeenCalledWith(
      'project:worker',
      undefined,
    );
    expect(projectRepository.save).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid project import JSON', async () => {
    const { service } = createService();

    await expect(
      service.importProjectsFromJson(Buffer.from('{')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
