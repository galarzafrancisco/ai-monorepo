import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { TAG_COLOR_PALETTE } from '../tag-color-palette';
import { ProjectEntity } from '../project.entity';
import { TagEntity } from '../tag.entity';
import { CreateProjectInput } from '../dto/service/projects.service.types';

/** Creates or updates a project and its project tag as one transaction. */
@Injectable()
export class CreateProjectUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(input: CreateProjectInput): Promise<ProjectEntity> {
    const tagName = `project:${input.slug}`;
    return this.dataSource.transaction(async (manager) => {
      const tagRepository = manager.getRepository(TagEntity);
      const projectRepository = manager.getRepository(ProjectEntity);
      let tag = await tagRepository.findOne({ where: { name: tagName } });
      if (!tag) {
        try {
          tag = await tagRepository.save(
            tagRepository.create({
              name: tagName,
              color: input.color ?? this.randomColor(),
            }),
          );
        } catch (error) {
          if (!(error instanceof QueryFailedError)) throw error;
          tag = await tagRepository.findOne({ where: { name: tagName } });
          if (!tag) throw error;
        }
      }

      let project = await projectRepository.findOne({
        where: { tagId: tag.id },
        relations: ['tag'],
      });
      if (!project) {
        project = await projectRepository.save(
          projectRepository.create({
            tagId: tag.id,
            slug: input.slug,
            description: input.description,
            repoUrl: input.repoUrl,
          }),
        );
      } else {
        project.slug = input.slug;
        project.description = input.description;
        project.repoUrl = input.repoUrl;
        project = await projectRepository.save(project);
      }
      project.tag = tag;
      return project;
    });
  }

  private randomColor(): string {
    return TAG_COLOR_PALETTE[
      Math.floor(Math.random() * TAG_COLOR_PALETTE.length)
    ];
  }
}
