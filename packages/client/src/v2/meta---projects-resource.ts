import { BaseClient, ClientConfig } from './base-client.js';
import type { CreateProjectDto, ImportProjectsResponseDto, PatchProjectDto, ProjectResponseDto } from './types.js';

export class MetaProjectsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new project */
  async ProjectsController_createProject(params: { body: CreateProjectDto; signal?: AbortSignal }): Promise<ProjectResponseDto> {
    return this.request('POST', '/api/v1/meta/projects', { body: params.body, signal: params?.signal });
  }

  /** Get all projects */
  async ProjectsController_getAllProjects(params?: { signal?: AbortSignal }): Promise<ProjectResponseDto[]> {
    return this.request('GET', '/api/v1/meta/projects', { signal: params?.signal });
  }

  /** Export all projects as JSON */
  async ProjectsController_exportProjects(params?: { signal?: AbortSignal }): Promise<Blob> {
    return this.request('GET', '/api/v1/meta/projects/export', { signal: params?.signal });
  }

  /** Import projects from JSON */
  async ProjectsController_importProjects(params: { body: FormData; signal?: AbortSignal }): Promise<ImportProjectsResponseDto> {
    return this.request('POST', '/api/v1/meta/projects/import', { body: params.body, bodyType: 'form-data', signal: params?.signal });
  }

  /** Search projects by name and description */
  async ProjectsController_searchProjects(params: { q: string; limit?: number; threshold?: number; signal?: AbortSignal }): Promise<ProjectResponseDto[]> {
    return this.request('GET', '/api/v1/meta/projects/search', { params: { q: params.q, limit: params.limit, threshold: params.threshold }, signal: params?.signal });
  }

  /** Get project by slug */
  async ProjectsController_getProjectBySlug(params: { slug: string; signal?: AbortSignal }): Promise<ProjectResponseDto> {
    return this.request('GET', `/api/v1/meta/projects/by-slug/${params.slug}`, { signal: params?.signal });
  }

  /** Get project by ID */
  async ProjectsController_getProject(params: { projectId: string; signal?: AbortSignal }): Promise<ProjectResponseDto> {
    return this.request('GET', `/api/v1/meta/projects/${params.projectId}`, { signal: params?.signal });
  }

  /** Update project (partial update) */
  async ProjectsController_updateProject(params: { projectId: string; body: PatchProjectDto; signal?: AbortSignal }): Promise<ProjectResponseDto> {
    return this.request('PATCH', `/api/v1/meta/projects/${params.projectId}`, { body: params.body, signal: params?.signal });
  }

  /** Delete a project */
  async ProjectsController_deleteProject(params: { projectId: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/meta/projects/${params.projectId}`, { responseType: 'void', signal: params?.signal });
  }

}