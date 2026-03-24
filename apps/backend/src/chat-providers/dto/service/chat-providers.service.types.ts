import { ChatProviderType } from '../../enums';

export type CreateChatProviderInput = {
  name: string;
  type: ChatProviderType;
  secretId?: string | null;
};

export type UpdateChatProviderInput = {
  name?: string;
  secretId?: string | null;
  apiKey?: string;
  createdByActorId?: string;
};

export type SetActiveChatProviderInput = {
  providerId: string;
};

export type ChatProviderResult = {
  id: string;
  name: string;
  type: ChatProviderType;
  secretId: string | null;
  isActive: boolean;
  isConfigured: boolean;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ActiveChatProviderConfigResult = {
  type: ChatProviderType;
  apiKey: string;
};
