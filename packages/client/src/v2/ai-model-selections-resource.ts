import { BaseClient, ClientConfig } from './base-client.js';
import type { AiModelSelectionResponseDto, SetAiModelSelectionDto } from './types.js';

export class AiModelSelectionsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** List which model each job uses */
  async AiModelSelectionsController_listAiModelSelections(params?: { signal?: AbortSignal }): Promise<AiModelSelectionResponseDto[]> {
    return this.request('GET', '/api/v1/ai-model-selections', { signal: params?.signal });
  }

  /** Select the provider and model a job uses */
  async AiModelSelectionsController_setAiModelSelection(params: { job: 'conversation' | 'quick_tasks' | 'middle_manager' | 'embeddings'; body: SetAiModelSelectionDto; signal?: AbortSignal }): Promise<AiModelSelectionResponseDto> {
    return this.request('PUT', `/api/v1/ai-model-selections/${params.job}`, { body: params.body, signal: params?.signal });
  }

  /** Clear a job's selection */
  async AiModelSelectionsController_clearAiModelSelection(params: { job: 'conversation' | 'quick_tasks' | 'middle_manager' | 'embeddings'; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/ai-model-selections/${params.job}`, { responseType: 'void', signal: params?.signal });
  }

}