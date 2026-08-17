import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from './project.entity';
import { SearchService } from '../search/search.service';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectResult,
  SearchProjectsInput,
  ExportedProject,
  ProjectsExportPayload,
} from './dto/service/projects.service.types';
import { DeleteProjectUseCase } from './use-cases/delete-project.use-case';
import { CreateProjectUseCase } from './use-cases/create-project.use-case';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    private readonly searchService: SearchService,
    private readonly deleteProjectUseCase: DeleteProjectUseCase,
    private readonly createProjectUseCase: CreateProjectUseCase,
  ) {}

  /**
   * Create a new project with associated tag
   */
  async createProject(input: CreateProjectInput): Promise<ProjectResult> {
    this.logger.log({
      message: 'Creating project',
      slug: input.slug,
    });

    const project = await this.createProjectUseCase.execute(input);

    this.logger.log({
      message: 'Project created or updated',
      projectId: project.id,
      slug: project.slug,
      tagId: project.tagId,
    });

    return this.mapProjectToResult(project);
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<ProjectResult[]> {
    this.logger.log({ message: 'Getting all projects' });

    const projects = await this.projectRepository.find({
      relations: ['tag'],
      order: { slug: 'ASC' },
    });

    this.logger.log({
      message: 'Projects retrieved',
      count: projects.length,
    });

    return projects.map((project) => this.mapProjectToResult(project));
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId: string): Promise<ProjectResult> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['tag'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return this.mapProjectToResult(project);
  }

  /**
   * Get project by slug
   */
  async getProjectBySlug(slug: string): Promise<ProjectResult | null> {
    const project = await this.projectRepository.findOne({
      where: { slug },
      relations: ['tag'],
    });

    return project ? this.mapProjectToResult(project) : null;
  }

  /**
   * Search projects by name and description
   */
  async searchProjects(input: SearchProjectsInput): Promise<ProjectResult[]> {
    this.logger.log({
      message: 'Searching projects',
      query: input.query,
    });

    // Get all projects
    const projects = await this.getAllProjects();

    // Use search service to fuzzy search
    const searchResults = this.searchService.search({
      items: projects,
      primaryField: 'slug',
      secondaryField: 'description',
      query: input.query,
      limit: input.limit,
      threshold: input.threshold,
    });

    this.logger.log({
      message: 'Project search completed',
      resultCount: searchResults.length,
    });

    // Return the items from search results
    return searchResults.map((result) => result.item);
  }

  async exportProjectsAsJson(): Promise<Buffer> {
    this.logger.log({ message: 'Exporting projects to JSON' });

    const projects = await this.getAllProjects();
    const payload: ProjectsExportPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: projects.map((project) => ({
        slug: project.slug,
        description: project.description,
        repoUrl: project.repoUrl,
        color: project.tagColor,
      })),
    };

    return Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  async importProjectsFromJson(
    fileBuffer: Buffer,
  ): Promise<{ importedCount: number }> {
    this.logger.log({ message: 'Importing projects from JSON' });

    let parsed: unknown;
    try {
      parsed = JSON.parse(fileBuffer.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid projects JSON file');
    }

    const rawProjects = this.extractProjectsFromImportPayload(parsed);
    let importedCount = 0;

    for (const rawProject of rawProjects) {
      const project = this.normalizeImportedProject(rawProject);
      await this.createProject(project);
      importedCount += 1;
    }

    this.logger.log({
      message: 'Imported projects from JSON',
      importedCount,
    });

    return { importedCount };
  }

  /**
   * Update project (partial update)
   */
  async updateProject(
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectResult> {
    this.logger.log({
      message: 'Updating project',
      projectId,
    });

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['tag'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Update only provided fields
    if (input.description !== undefined) {
      project.description = input.description;
    }
    if (input.repoUrl !== undefined) {
      project.repoUrl = input.repoUrl;
    }

    const updatedProject = await this.projectRepository.save(project);

    this.logger.log({
      message: 'Project updated',
      projectId: updatedProject.id,
    });

    return this.mapProjectToResult(updatedProject);
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    this.logger.log({
      message: 'Deleting project',
      projectId,
    });

    const deleted = await this.deleteProjectUseCase.execute(projectId);
    if (!deleted) {
      this.logger.warn({
        message: 'Project not found for deletion',
        projectId,
      });
      return;
    }

    this.logger.log({
      message: 'Project deleted',
      projectId,
    });
  }

  private mapProjectToResult(project: ProjectEntity): ProjectResult {
    return {
      id: project.id,
      tagId: project.tagId,
      tagName: project.tag.name,
      tagColor: project.tag.color,
      slug: project.slug,
      description: project.description,
      repoUrl: project.repoUrl,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private extractProjectsFromImportPayload(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { projects?: unknown }).projects)
    ) {
      return (payload as { projects: unknown[] }).projects;
    }

    throw new BadRequestException(
      'Projects JSON must contain a projects array',
    );
  }

  private normalizeImportedProject(project: unknown): ExportedProject {
    if (!project || typeof project !== 'object') {
      throw new BadRequestException('Each imported project must be an object');
    }

    const rawProject = project as Record<string, unknown>;
    if (typeof rawProject.slug !== 'string' || rawProject.slug.trim() === '') {
      throw new BadRequestException(
        'Each imported project must include a slug',
      );
    }

    return {
      slug: rawProject.slug.trim(),
      description: this.optionalString(rawProject.description, 'description'),
      repoUrl: this.optionalString(rawProject.repoUrl, 'repoUrl'),
      color: this.optionalString(rawProject.color, 'color'),
    };
  }

  private optionalString(
    value: unknown,
    fieldName: string,
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(
        `Imported project ${fieldName} must be a string`,
      );
    }

    return value;
  }
}
