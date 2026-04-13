import { BaseClient, ClientConfig } from './base-client.js';
import type { AgentListResponseDto, AgentResponseDto, AgentTemplateCatalogResponseDto, AgentToolPermissionResponseDto, CreateAgentDto, PatchAgentDto, UpsertAgentToolPermissionDto } from './types.js';

export class AgentResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new agent */
  async AgentsController_createAgent(params: { body: CreateAgentDto; signal?: AbortSignal }): Promise<AgentResponseDto> {
    return this.request('POST', '/api/v1/agents', { body: params.body, signal: params?.signal });
  }

  /** List agents with optional filtering and pagination */
  async AgentsController_listAgents(params?: { isActive?: boolean; page?: number; limit?: number; signal?: AbortSignal }): Promise<AgentListResponseDto> {
    return this.request('GET', '/api/v1/agents', { params: { isActive: params?.isActive, page: params?.page, limit: params?.limit }, signal: params?.signal });
  }

  /** List available agent creation templates */
  async AgentsController_listAgentTemplates(params?: { signal?: AbortSignal }): Promise<AgentTemplateCatalogResponseDto> {
    return this.request('GET', '/api/v1/agents/templates', { signal: params?.signal });
  }

  /** Get an agent by slug */
  async AgentsController_getAgentBySlug(params: { slug: string; signal?: AbortSignal }): Promise<AgentResponseDto> {
    return this.request('GET', `/api/v1/agents/${params.slug}`, { signal: params?.signal });
  }

  /** Patch an agent and its linked actor fields */
  async AgentsController_patchAgent(params: { actorId: string; body: PatchAgentDto; signal?: AbortSignal }): Promise<AgentResponseDto> {
    return this.request('PATCH', `/api/v1/agents/${params.actorId}`, { body: params.body, signal: params?.signal });
  }

  /** Delete an agent */
  async AgentsController_deleteAgent(params: { actorId: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/agents/${params.actorId}`, { responseType: 'void', signal: params?.signal });
  }

  /** List tool permissions for an agent */
  async AgentToolPermissionsController_listAgentToolPermissions(params: { actorId: string; signal?: AbortSignal }): Promise<AgentToolPermissionResponseDto[]> {
    return this.request('GET', `/api/v1/agents/${params.actorId}/tool-permissions`, { signal: params?.signal });
  }

  /** Create or replace an agent tool permission assignment */
  async AgentToolPermissionsController_upsertAgentToolPermission(params: { actorId: string; serverId: string; body: UpsertAgentToolPermissionDto; signal?: AbortSignal }): Promise<AgentToolPermissionResponseDto> {
    return this.request('PUT', `/api/v1/agents/${params.actorId}/tool-permissions/${params.serverId}`, { body: params.body, signal: params?.signal });
  }

  /** Delete an agent tool permission assignment */
  async AgentToolPermissionsController_deleteAgentToolPermission(params: { actorId: string; serverId: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/agents/${params.actorId}/tool-permissions/${params.serverId}`, { responseType: 'void', signal: params?.signal });
  }

}