import { AiModelJob, AiModelKind, AiProviderType } from '../../enums';

export type CreateAiProviderInput = {
  name: string;
  type: AiProviderType;
  secretId?: string | null;
  baseUrl?: string | null;
  project?: string | null;
  location?: string | null;
};

export type UpdateAiProviderInput = {
  name?: string;
  secretId?: string | null;
  apiKey?: string;
  createdByActorId?: string;
  baseUrl?: string | null;
  project?: string | null;
  location?: string | null;
};

export type AiProviderResult = {
  id: string;
  name: string;
  type: AiProviderType;
  secretId: string | null;
  baseUrl: string | null;
  project: string | null;
  location: string | null;
  isConfigured: boolean;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AiProviderConfigResult = {
  id: string;
  type: AiProviderType;
  /** Secret value: an API key, or service account JSON for Vertex AI. */
  apiKey: string | null;
  baseUrl: string | null;
  project: string | null;
  location: string | null;
};

export type AiProviderModelResult = {
  id: string;
  displayName: string | null;
  kind: AiModelKind;
};

export type SetAiModelSelectionInput = {
  job: AiModelJob;
  aiProviderId: string;
  modelId: string;
};

export type AiModelSelectionResult = {
  job: AiModelJob;
  /** The job's own selection. Null when nothing is selected for it. */
  aiProviderId: string | null;
  modelId: string | null;
  /** True when the job has no selection of its own and uses the conversation model. */
  followsConversation: boolean;
  /** What the job runs on after applying the fallback. */
  effectiveAiProviderId: string | null;
  effectiveModelId: string | null;
  /** Whether the job can make a call: a model is selected and its provider is configured. */
  isReady: boolean;
};

export type ResolvedAiModelSelection = {
  provider: AiProviderConfigResult;
  modelId: string;
};
