import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionalTagWriterService } from '../transactional-tag-writer.service';
import { ProjectEntity } from '../project.entity';

/** Deletes a project and applies the shared tag-orphan policy atomically. */
@Injectable()
export class DeleteProjectUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tagWriter: TransactionalTagWriterService,
  ) {}

  async execute(projectId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const projectRepository = manager.getRepository(ProjectEntity);
      const project = await projectRepository.findOne({
        where: { id: projectId },
      });
      if (!project) return false;

      await projectRepository.softRemove(project);
      await this.tagWriter.cleanupOrphaned(manager, project.tagId);
      return true;
    });
  }
}
