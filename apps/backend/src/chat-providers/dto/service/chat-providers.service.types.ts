import { ChatProviderType } from '../../enums';

export type CreateChatProviderInput = {
  name: string;
  type: ChatProviderType;
  secretId?: string | null;
  modelId?: string | null;
  baseUrl?: string | null;
  project?: string | null;
  location?: string | null;
};

export type UpdateChatProviderInput = {
  name?: string;
  secretId?: string | null;
  apiKey?: string;
  createdByActorId?: string;
  modelId?: string | null;
  baseUrl?: string | null;
  project?: string | null;
  location?: string | null;
};

export type SetActiveChatProviderInput = {
  providerId: string;
};

export type ChatProviderResult = {
  id: string;
  name: string;
  type: ChatProviderType;
  secretId: string | null;
  modelId: string | null;
  baseUrl: string | null;
  project: string | null;
  location: string | null;
  isActive: boolean;
  isConfigured: boolean;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatProviderConfigResult = {
  id: string;
  type: ChatProviderType;
  /** Secret value: an API key, or service account JSON for Vertex AI. */
  apiKey: string | null;
  modelId: string | null;
  baseUrl: string | null;
  project: string | null;
  location: string | null;
};

export type ActiveChatSelectionResult = {
  chatProviderId: string;
  modelId: string | null;
};
