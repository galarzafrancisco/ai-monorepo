import {
  AiModelJob,
  AiModelKind,
  AiProviderConnectionStatus,
  AiProviderType,
} from '../../enums';

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

/** Who a request that runs on a person's own plan is for. */
export type OnBehalfOf = {
  /** Actor whose message started the turn, or who the automated turn is for. */
  actorId: string;
  /** True when nobody typed a message: the turn was started by a task update. */
  automated: boolean;
  /** Who the actor is, for error messages, e.g. "the person who created this thread". */
  description?: string;
};

export type AiProviderConnectionResult = {
  aiProviderId: string;
  status: AiProviderConnectionStatus;
  /** Email of the connected account, to tell accounts apart. Null when not connected. */
  accountEmail: string | null;
  /** True when requests can run on this person's plan right now. */
  canUsePlan: boolean;
  automatedTurnsAllowed: boolean;
  /** True while a sign-in was started and not finished. */
  isAuthorizationPending: boolean;
  /** The provider's code for the last failed request, e.g. a usage limit. */
  lastErrorCode: string | null;
  lastErrorAt: Date | null;
  manageUsageUrl: string;
};

export type StartAiProviderAuthorizationResult = {
  /** Where to send the browser. */
  authorizationUrl: string;
  expiresAt: Date;
};

export type CompleteAiProviderAuthorizationInput = {
  state: string;
  code?: string | null;
  clientId?: string | null;
  error?: string | null;
  errorDescription?: string | null;
};

export type DisconnectAiProviderResult = {
  /** False when the provider could not be told; the local tokens are gone either way. */
  revokedAtProvider: boolean;
};
