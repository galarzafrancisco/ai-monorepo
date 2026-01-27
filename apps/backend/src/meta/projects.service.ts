import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from './project.entity';
import { MetaService } from './meta.service';
import { SearchService } from '../search/search.service';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectResult,
  SearchProjectsInput,
} from './dto/service/projects.service.types';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    private readonly metaService: MetaService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Create a new project with associated tag
   */
  async createProject(input: CreateProjectInput): Promise<ProjectResult> {
    this.logger.log({
      message: 'Creating project',
      slug: input.slug,
    });

    // Create tag with project: prefix
    const tagName = `project:${input.slug}`;
    const tag = await this.metaService.findOrCreateTagEntity(
      tagName,
      input.color,
    );

    // Check if project already exists
    let project = await this.projectRepository.findOne({
      where: { tagId: tag.id },
      relations: ['tag'],
    });

    if (!project) {
      // Create new project
      project = this.projectRepository.create({
        tagId: tag.id,
        slug: input.slug,
        description: input.description,
        repoUrl: input.repoUrl,
      });
      project = await this.projectRepository.save(project);
      project.tag = tag;

      this.logger.log({
        message: 'Project created',
        projectId: project.id,
        slug: project.slug,
        tagId: tag.id,
      });
    } else {
      this.logger.log({
        message: 'Project already exists',
        projectId: project.id,
        slug: project.slug,
      });
    }

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

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      this.logger.warn({
        message: 'Project not found for deletion',
        projectId,
      });
      return;
    }

    // Soft delete project
    await this.projectRepository.softDelete(projectId);

    // Also delete the associated tag
    await this.metaService.deleteTag(project.tagId);

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
}
