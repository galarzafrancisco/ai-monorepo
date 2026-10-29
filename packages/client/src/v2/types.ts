// Auto-generated types from OpenAPI spec
// Do not edit manually

export interface CreateTagDto {
  name: string;
}

export interface MetaTagResponseDto {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VersionResponseDto {
  backend: string;
  ui: string;
}

export interface CreateProjectDto {
  slug: string;
  description?: string;
  repoUrl?: string;
  githubConnectionId?: string | null;
  githubForWorker?: boolean;
  color?: string;
}

export interface ProjectResponseDto {
  id: string;
  tagId: string;
  tagName: string;
  tagColor: string;
  slug: string;
  description?: string;
  repoUrl?: string;
  githubConnectionId: string | null;
  githubForWorker: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatchProjectDto {
  description?: string;
  repoUrl?: string;
  githubConnectionId?: string | null;
  githubForWorker?: boolean;
}

export interface RegisterClientDto {
  redirect_uris: string[];
  token_endpoint_auth_method: 'none' | 'client_secret_basic' | 'private_key_jwt';
  grant_types: ('authorization_code' | 'refresh_token')[];
  response_types: 'code'[];
  client_name: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  client_uri?: string;
  logo_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  jwks?: string;
  software_id?: string;
  software_version?: string;
}

export interface ClientRegistrationResponseDto {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: ('authorization_code' | 'refresh_token')[];
  token_endpoint_auth_method: 'none' | 'client_secret_basic' | 'private_key_jwt';
  scope?: string | null;
  contacts?: string[] | null;
  client_id_issued_at: number;
}

export interface ConsentDecisionDto {
  flow_id: string;
  approved: boolean;
}

export interface FlowServerDto {
  providedId: string;
  name: string;
  description: string;
}

export interface FlowClientDto {
  clientId: string;
  clientName: string;
  registrationMethod: 'dynamic_registration' | 'metadata_document';
}

export interface GetConsentMetadataResponseDto {
  id: string;
  status: 'CLIENT_NOT_REGISTERED' | 'CLIENT_REGISTERED' | 'AUTHORIZATION_REQUEST_STARTED' | 'USER_CONSENT_OK' | 'USER_CONSENT_REJECTED' | 'WAITING_ON_DOWNSTREAM_AUTH' | 'AUTHORIZATION_CODE_ISSUED' | 'AUTHORIZATION_CODE_EXCHANGED';
  scopes?: string[];
  resource?: string;
  server: FlowServerDto;
  client: FlowClientDto;
  redirectUri: string;
  createdAt: string;
}

export interface TokenRequestDto {
  grant_type: 'authorization_code' | 'refresh_token';
  client_id?: string;
  client_assertion_type?: string;
  client_assertion?: string;
  code?: string;
  redirect_uri?: string;
  code_verifier?: string;
  refresh_token?: string;
  scope?: string;
  resource?: string;
}

export interface TokenResponseDto {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope?: string;
}

export interface IntrospectTokenRequestDto {
  token: string;
  token_type_hint?: 'access_token' | 'refresh_token';
  client_id?: string;
  client_secret?: string | null;
}

export interface IntrospectTokenResponseDto {
  active: boolean;
  token_type?: 'Bearer';
  client_id?: string;
  sub?: Record<string, any>;
  aud?: any;
  iss?: Record<string, any>;
  jti?: Record<string, any>;
  exp?: Record<string, any>;
  iat?: Record<string, any>;
  scope?: string;
  mcp_server_identifier?: Record<string, any>;
  resource?: Record<string, any>;
  version?: Record<string, any>;
}

export interface TokenExchangeRequestDto {
  grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange';
  subject_token: string;
  subject_token_type: 'urn:ietf:params:oauth:token-type:access_token';
  resource: string;
  scope?: string;
}

export interface TokenExchangeResponseDto {
  access_token: string;
  issued_token_type: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface ScopeDto {
  id: string;
  description: string;
}

export interface ScopesResponseDto {
  scopes: ScopeDto[];
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface UserResponseDto {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'standard';
  actorId: string;
  onboardingDisplayMode: 'FULL_PAGE' | 'BANNER' | 'OFF';
}

export interface LoginResponseDto {
  user: UserResponseDto;
  expiresIn: number;
}

export interface ManagedUserResponseDto {
  id: string;
  email: string;
  displayName: string;
  slug: string;
  actorId: string;
  role: 'admin' | 'standard';
  isActive: boolean;
  passwordSetupPending: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateManagedUserRequestDto {
  email: string;
  role: 'admin' | 'standard';
}

export interface AccountSetupStatusRequestDto {
  email: string;
}

export interface AccountSetupStatusResponseDto {
  email: string;
  canSetup: boolean;
}

export interface SetupManagedUserRequestDto {
  email: string;
  displayName: string;
  slug: string;
  password: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

export interface OnboardingStatusResponseDto {
  needsOnboarding: boolean;
}

export interface OnboardingRequestDto {
  email: string;
  displayName: string;
  slug: string;
  password: string;
}

export interface ActorResponseDto {
  id: string;
  type: 'human' | 'agent';
  slug: string;
  displayName: string;
  avatarUrl?: string | null;
  introduction?: string | null;
  deletedAt: string | null;
}

export interface McpFlowResponseDto {
  id: string;
  authorizationJourneyId: string;
  serverId: string;
  clientId: string;
  clientName?: string | null;
  status: 'CLIENT_NOT_REGISTERED' | 'CLIENT_REGISTERED' | 'AUTHORIZATION_REQUEST_STARTED' | 'USER_CONSENT_OK' | 'USER_CONSENT_REJECTED' | 'WAITING_ON_DOWNSTREAM_AUTH' | 'AUTHORIZATION_CODE_ISSUED' | 'AUTHORIZATION_CODE_EXCHANGED';
  scope?: string | null;
  authorizationCodeExpiresAt?: string | null;
  authorizationCodeUsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionFlowResponseDto {
  id: string;
  authorizationJourneyId: string;
  mcpConnectionId: string;
  connectionName?: string | null;
  status: 'pending' | 'authorized' | 'failed';
  tokenExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthJourneyResponseDto {
  id: string;
  status: 'not_started' | 'USER_CONSENT_REJECTED' | 'mcp_auth_flow_started' | 'mcp_auth_flow_completed' | 'connections_flow_started' | 'connections_flow_completed' | 'authorization_code_issued' | 'authorization_code_exchanged';
  actor: ActorResponseDto | null;
  mcpAuthorizationFlow: McpFlowResponseDto;
  connectionAuthorizationFlows: ConnectionFlowResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerDto {
  providedId: string;
  name: string;
  description: string;
  type: 'http' | 'stdio';
  authType?: 'taico' | 'external';
  url?: string;
  cmd?: string;
  args?: string[];
}

export interface ServerResponseDto {
  id: string;
  providedId: string;
  name: string;
  description: string;
  type: 'http' | 'stdio';
  authType: 'taico' | 'external';
  url?: string;
  cmd?: string;
  args?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ServerListResponseDto {
  items: ServerResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateServerDto {
  type?: 'http' | 'stdio';
  authType?: 'taico' | 'external';
  name?: string;
  description?: string;
  url?: string;
  cmd?: string;
  args?: string[];
}

export interface DeleteServerResponseDto {
  message: string;
}

export interface CreateScopeDto {
  id: string;
  description: string;
}

export interface ScopeResponseDto {
  id: string;
  description: string;
  serverId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteScopeResponseDto {
  message: string;
}

export interface CreateConnectionDto {
  friendlyName: string;
  providedId?: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
}

export interface ConnectionResponseDto {
  id: string;
  serverId: string;
  friendlyName: string;
  clientId: string;
  clientSecret?: string | null;
  authorizeUrl: string;
  tokenUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateConnectionDto {
  friendlyName?: string;
  providedId?: string;
  clientId?: string;
  clientSecret?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
}

export interface DeleteConnectionResponseDto {
  message: string;
}

export interface CreateMappingDto {
  scopeId: string;
  connectionId: string;
  downstreamScope: string;
}

export interface MappingResponseDto {
  id: string;
  scopeId: string;
  serverId: string;
  connectionId: string;
  downstreamScope: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteMappingResponseDto {
  message: string;
}

export interface JwkResponseDto {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

export interface JwksResponseDto {
  keys: JwkResponseDto[];
}

export interface CreateAiProviderDto {
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'google_vertex' | 'xai' | 'openai_compatible' | 'chatgpt_subscription';
  secretId?: string;
  baseUrl?: string | null;
  project?: string | null;
  location?: string | null;
}

export interface AiProviderResponseDto {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'google_vertex' | 'xai' | 'openai_compatible' | 'chatgpt_subscription';
  secretId?: string | null;
  baseUrl?: string | null;
  project?: string | null;
  location?: string | null;
  isConfigured: boolean;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAiProviderDto {
  name?: string;
  secretId?: string;
  apiKey?: string;
  baseUrl?: string | null;
  project?: string | null;
  location?: string | null;
}

export interface AiProviderModelResponseDto {
  id: string;
  displayName?: string | null;
  kind: 'language' | 'embedding';
}

export interface AiModelSelectionResponseDto {
  job: 'conversation' | 'user_small_tasks' | 'system_small_tasks' | 'middle_manager' | 'embeddings';
  aiProviderId?: string | null;
  modelId?: string | null;
  followsConversation: boolean;
  effectiveAiProviderId?: string | null;
  effectiveModelId?: string | null;
  isReady: boolean;
}

export interface SetAiModelSelectionDto {
  aiProviderId: string;
  modelId: string;
}

export interface AiProviderConnectionResponseDto {
  aiProviderId: string;
  status: 'connected' | 'plan_access_not_granted' | 'needs_reauthorization' | 'disconnected';
  accountEmail?: string | null;
  canUsePlan: boolean;
  automatedTurnsAllowed: boolean;
  isAuthorizationPending: boolean;
  lastErrorCode?: string | null;
  lastErrorAt?: string | null;
  manageUsageUrl: string;
}

export interface StartAiProviderAuthorizationResponseDto {
  authorizationUrl: string;
  expiresAt: string;
}

export interface CompleteAiProviderAuthorizationDto {
  callbackUrl?: string;
  state?: string;
  code?: string;
  clientId?: string;
  error?: string;
  errorDescription?: string;
}

export interface UpdateAiProviderConnectionDto {
  automatedTurnsAllowed: boolean;
}

export interface DisconnectAiProviderResponseDto {
  revokedAtProvider: boolean;
}

export interface CreateSecretDto {
  name: string;
  description?: string;
  value: string;
}

export interface SecretResponseDto {
  id: string;
  name: string;
  description?: string | null;
  createdByActorId: string;
  createdBy?: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SecretValueResponseDto {
  id: string;
  name: string;
  value: string;
}

export interface UpdateSecretDto {
  name?: string;
  description?: string | null;
  value?: string;
}

export interface CreateTaskDto {
  name: string;
  description: string;
  assigneeActorId?: string;
  sessionId?: string;
  tagNames?: string[];
  dependsOnIds?: string[];
}

export interface CommentResponseDto {
  id: string;
  taskId: string;
  commenterName: string;
  commenterActor?: ActorResponseDto | null;
  content: string;
  createdAt: string;
}

export interface ArtefactResponseDto {
  id: string;
  taskId: string;
  name: string;
  link: string;
  createdAt: string;
}

export interface InputRequestResponseDto {
  id: string;
  taskId: string;
  askedByActorId: string;
  assignedToActorId: string;
  question: string;
  answer?: Record<string, any> | null;
  resolvedAt?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TagResponseDto {
  id: string;
  name: string;
  color?: string;
}

export interface TaskResponseDto {
  id: string;
  name: string;
  description: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE';
  assignee?: string | null;
  assigneeActor?: ActorResponseDto | null;
  sessionId?: string | null;
  comments: CommentResponseDto[];
  artefacts: ArtefactResponseDto[];
  inputRequests: InputRequestResponseDto[];
  tags: TagResponseDto[];
  createdByActor: ActorResponseDto;
  dependsOnIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTaskDto {
  name?: string;
  description?: string;
  assigneeActorId?: string;
  sessionId?: string;
  tagNames?: string[];
  dependsOnIds?: string[];
}

export interface AssignTaskDto {
  assigneeActorId?: string;
  sessionId?: string;
}

export interface TaskListResponseDto {
  items: TaskResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type SearchStrategy = 'keyword' | 'fuzzy_title' | 'semantic';

export type SearchMatchField = 'title' | 'content' | 'comment';

export interface TaskSearchResultDto {
  id: string;
  name: string;
  status?: string | null;
  score: number;
  matchedBy: SearchStrategy[];
  matchedOn: SearchMatchField;
  excerpt: string;
  excerptIsComplete: boolean;
  commentId?: string | null;
  commentAuthor?: string | null;
}

export interface CreateCommentDto {
  content: string;
}

export interface CreateArtefactDto {
  name: string;
  link: string;
}

export interface ChangeTaskStatusDto {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE';
  comment?: string;
}

export interface CreateInputRequestDto {
  assignedToActorId?: string;
  question: string;
}

export interface AnswerInputRequestDto {
  answer: string;
}

export interface CreateAgentRunDto {
  parentTaskId: string;
  taskExecutionId?: string | null;
}

export interface TaskInfoDto {
  id: string;
  name: string;
}

export interface AgentRunResponseDto {
  id: string;
  actorId: string;
  actor?: ActorResponseDto | null;
  parentTaskId: string;
  parentTask?: TaskInfoDto | null;
  createdAt: string;
  startedAt?: Record<string, any> | null;
  endedAt?: Record<string, any> | null;
  lastPing?: Record<string, any> | null;
  taskExecutionId?: string | null;
}

export interface AgentRunListResponseDto {
  items: AgentRunResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateAgentRunDto {
  startedAt?: string | null;
  endedAt?: string | null;
  lastPing?: string | null;
  taskExecutionId?: string | null;
}

export interface CreateThreadDto {
  title?: string;
  parentTaskId?: string;
  tagNames?: string[];
  taskIds?: string[];
  contextBlockIds?: string[];
  participantActorIds?: string[];
}

export interface TaskSummaryResponseDto {
  id: string;
  name: string;
  description: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE';
  assigneeActor?: ActorResponseDto | null;
  createdByActor: ActorResponseDto;
  tags: TagResponseDto[];
  commentCount: number;
  inputRequests: InputRequestResponseDto[];
  updatedAt: string;
}

export interface ContextBlockSummaryResponseDto {
  id: string;
  title: string;
}

export interface TaskSubscriptionResponseDto {
  taskId: string;
  name: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE';
  createdAt: string;
}

export type ThreadTimerKind = 'reminder' | 'schedule';

export interface ThreadTimerResponseDto {
  id: string;
  kind: ThreadTimerKind;
  reason: string;
  periodSeconds: number | null;
  maxIterations: number;
  firedCount: number;
  nextFireAt: string;
  createdAt: string;
}

export type ThreadWatchKind = 'pull_request';

export interface ThreadWatchResponseDto {
  id: string;
  kind: ThreadWatchKind;
  targetId: string;
  targetLabel: string;
  targetUrl: string | null;
  conditions: string[];
  once: boolean;
  waitingFor: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface ThreadResponseDto {
  id: string;
  title: string;
  createdByActor: ActorResponseDto;
  parentTaskId?: string | null;
  stateContextBlockId: string;
  tasks: TaskSummaryResponseDto[];
  referencedContextBlocks: ContextBlockSummaryResponseDto[];
  tags: MetaTagResponseDto[];
  participants: ActorResponseDto[];
  taskSubscriptions: TaskSubscriptionResponseDto[];
  timers: ThreadTimerResponseDto[];
  watches: ThreadWatchResponseDto[];
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateThreadDto {
  title?: string;
}

export interface ThreadListItemResponseDto {
  id: string;
  title: string;
  stateContextBlockId: string;
  lastActivityAt: string;
  unreadCount: number;
  pinned: boolean;
}

export interface ThreadListResponseDto {
  items: ThreadListItemResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AttachTaskDto {
  taskId: string;
}

export type PullRequestState = 'open' | 'closed' | 'merged';

export type ChecksStatus = 'none' | 'pending' | 'success' | 'failure';

export type ReviewDecision = 'none' | 'approved' | 'changes_requested';

export interface PullRequestResponseDto {
  id: string;
  key: string;
  host: string;
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string | null;
  state: PullRequestState | null;
  draft: boolean;
  authorLogin: string | null;
  headRef: string | null;
  baseRef: string | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
  commentCount: number | null;
  checksStatus: ChecksStatus;
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  checksPending: number;
  failedChecks: string[];
  reviewDecision: ReviewDecision;
  approvals: number;
  mergedAt: string | null;
  closedAt: string | null;
  githubUpdatedAt: string | null;
  lastFetchedAt: string | null;
  lastError: string | null;
}

export type IssueState = 'open' | 'closed';

export type IssueStateReason = 'completed' | 'not_planned' | 'duplicate' | 'reopened';

export interface IssueLabelResponseDto {
  name: string;
  color: string | null;
}

export interface IssueResponseDto {
  id: string;
  key: string;
  host: string;
  owner: string;
  repo: string;
  number: number;
  url: string;
  title: string | null;
  state: IssueState | null;
  stateReason: IssueStateReason | null;
  isPullRequest: boolean;
  authorLogin: string | null;
  labels: IssueLabelResponseDto[];
  assignees: string[];
  milestone: string | null;
  commentCount: number | null;
  closedAt: string | null;
  githubUpdatedAt: string | null;
  lastFetchedAt: string | null;
  lastError: string | null;
}

export interface ReferenceContextBlockDto {
  contextBlockId: string;
}

export interface AddParticipantDto {
  actorId: string;
}

export interface ThreadStateResponseDto {
  content: string;
}

export interface ThreadTokenUsageResponseDto {
  contextTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  steps: number;
}

export interface UpdateThreadStateDto {
  content: string;
}

export interface AppendThreadStateDto {
  content: string;
}

export interface CreateThreadMessageDto {
  content: string;
  timezone?: string;
}

export interface ThreadMessageResponseDto {
  id: string;
  threadId: string;
  content: string;
  createdByActorId?: string | null;
  createdByActor?: ActorResponseDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListThreadMessagesResponseDto {
  items: ThreadMessageResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAgentDto {
  slug: string;
  name: string;
  type?: 'claude' | 'codex' | 'opencode' | 'adk' | 'githubcopilot' | 'other';
  description?: string;
  introduction?: string;
  avatarUrl?: string | null;
  systemPrompt: string;
  providerId?: string;
  modelId?: string;
  statusTriggers?: ('NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE')[];
  tagTriggers?: string[];
  allowedTools?: string[];
  isActive?: boolean;
  concurrencyLimit?: number;
}

export interface AgentResponseDto {
  actorId: string;
  slug: string;
  name: string;
  type: 'claude' | 'codex' | 'opencode' | 'adk' | 'githubcopilot' | 'other';
  description?: Record<string, any>;
  introduction?: Record<string, any>;
  avatarUrl?: string | null;
  systemPrompt: string;
  providerId?: string | null;
  modelId?: string | null;
  statusTriggers: ('NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE')[];
  tagTriggers: string[];
  allowedTools: string[];
  isActive: boolean;
  concurrencyLimit?: Record<string, any>;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: Record<string, any>;
}

export interface AgentListResponseDto {
  items: AgentResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AgentTemplateDto {
  id: string;
  label: string;
  description: string;
  type?: 'claude' | 'codex' | 'opencode' | 'adk' | 'githubcopilot' | 'other';
  providerId?: string;
  modelId?: string;
  systemPrompt: string;
  agentDescription?: string;
  statusTriggers: ('NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE')[];
  tagTriggers: string[];
  avatarUrl?: string;
  concurrencyLimit?: number;
}

export interface AgentTemplateModelOptionDto {
  id: string;
  label: string;
  providerId?: string;
  modelId?: string;
  isDefault: boolean;
}

export interface AgentTemplateHarnessDto {
  type: 'claude' | 'codex' | 'opencode' | 'adk' | 'githubcopilot' | 'other';
  label: string;
  description: string;
  modelOptions: AgentTemplateModelOptionDto[];
}

export interface AgentAvatarDto {
  id: string;
  label: string;
  url: string;
  description: string;
}

export interface AgentTemplateCatalogResponseDto {
  templates: AgentTemplateDto[];
  harnesses: AgentTemplateHarnessDto[];
  avatars: AgentAvatarDto[];
}

export interface PatchAgentDto {
  slug?: string;
  name?: string;
  systemPrompt?: string;
  providerId?: string;
  modelId?: string;
  statusTriggers?: ('NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE')[];
  tagTriggers?: string[];
  type?: 'claude' | 'codex' | 'opencode' | 'adk' | 'githubcopilot' | 'other';
  description?: string | null;
  introduction?: string | null;
  avatarUrl?: string | null;
  allowedTools?: string[];
  isActive?: boolean;
  concurrencyLimit?: number | null;
}

export interface AgentToolPermissionServerResponseDto {
  id: string;
  providedId: string;
  name: string;
  description: string;
  type: 'http' | 'stdio';
}

export interface AgentToolPermissionScopeResponseDto {
  id: string;
  description: string;
}

export interface AgentToolPermissionResponseDto {
  server: AgentToolPermissionServerResponseDto;
  grantedScopes: AgentToolPermissionScopeResponseDto[];
  hasAllScopes: boolean;
}

export interface UpsertAgentToolPermissionDto {
  scopeIds?: string[];
}

export interface IssueAccessTokenRequestDto {
  name: string;
  scopes: string[];
  expirationDays?: number;
}

export interface IssueAccessTokenResponseDto {
  id: string;
  name: string;
  token: string;
  scopes: string[];
  expiresAt: string;
  createdAt: string;
}

export interface IssuedAccessTokenResponseDto {
  id: string;
  name: string;
  scopes: string[];
  sub: string;
  subjectSlug: string;
  subjectDisplayName: string;
  issuedBy: string;
  issuedByDisplayName: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  isValid: boolean;
}

export interface RequestAgentExecutionTokenDto {
  scopes?: string[];
  expirationSeconds?: number;
}

export interface AgentExecutionTokenResponseDto {
  token: string;
  scopes: string[];
  expiresAt: string;
  agentSlug: string;
  requestedByClientId: string;
}

export interface CreateBlockDto {
  title: string;
  content: string;
  tagNames?: string[];
  parentId?: string;
}

export interface ContextTagResponseDto {
  id: string;
  name: string;
  color?: string;
}

export interface BlockResponseDto {
  id: string;
  title: string;
  content: string;
  createdByActorId: string;
  createdBy: string | null;
  tags: ContextTagResponseDto[];
  parentId: Record<string, any> | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlockSummaryDto {
  id: string;
  title: string;
  createdByActorId: string;
  createdBy: string | null;
  tags: ContextTagResponseDto[];
  parentId: Record<string, any> | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlockListResponseDto {
  items: BlockSummaryDto[];
}

export interface BlockSearchResultDto {
  id: string;
  title: string;
  score: number;
  matchedBy: SearchStrategy[];
  matchedOn: SearchMatchField;
  excerpt: string;
  excerptIsComplete: boolean;
}

export interface BlockTreeResponseDto {
  id: string;
  title: string;
  createdByActorId: string;
  createdBy: string | null;
  parentId: Record<string, any> | null;
  order: number;
  children: BlockTreeResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ImportBlocksResponseDto {
  importedCount: number;
}

export interface UpdateBlockDto {
  title?: string;
  content?: string;
  tagNames?: string[];
  parentId?: string | null;
  order?: number;
}

export interface AppendBlockDto {
  content: string;
}

export interface ReorderBlockDto {
  newOrder: number;
}

export interface MoveBlockDto {
  newParentId: Record<string, any> | null;
}

export interface LookupPullRequestsDto {
  refs: string[];
}

export type GithubAuthType = 'pat' | 'app';

export interface CreateGithubConnectionDto {
  name: string;
  baseUrl?: string | null;
  authType: GithubAuthType;
  secret: string;
  appId?: string | null;
  installationId?: string | null;
  owners?: string[];
}

export interface GithubConnectionResponseDto {
  id: string;
  name: string;
  baseUrl: string;
  host: string;
  authType: GithubAuthType;
  appId: string | null;
  installationId: string | null;
  owners: string[];
  accountLogin: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  lastWebhookAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface GithubRepositoryRefDto {
  host: string;
  owner: string;
  repo: string;
}

export type GithubConnectionMatch = 'project' | 'owner' | 'only_connection';

export interface GithubWebhookSourceDto {
  owner: string;
  repo: string | null;
  lastDeliveryAt: string;
  lastEvent: string | null;
  active: boolean;
}

export interface ResolvedGithubConnectionResponseDto {
  repository: GithubRepositoryRefDto | null;
  connection: GithubConnectionResponseDto | null;
  match: GithubConnectionMatch | null;
  webhook: GithubWebhookSourceDto | null;
}

export interface UpdateGithubConnectionDto {
  name?: string;
  baseUrl?: string;
  secret?: string;
  appId?: string | null;
  installationId?: string | null;
  owners?: string[];
}

export interface GithubWebhookSettingsResponseDto {
  url: string;
  secret: string;
  lastDeliveryAt: string | null;
  sources: GithubWebhookSourceDto[];
}

export interface LookupIssuesDto {
  refs: string[];
}

export interface TaskExecutionQueueEntryResponseDto {
  taskId: string;
  taskName: string | null;
  taskStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE' | null;
}

export interface TaskExecutionQueueListResponseDto {
  items: TaskExecutionQueueEntryResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActiveTaskExecutionTagSnapshotResponseDto {
  id: string;
  name: string;
}

export interface ExecutionStatsResponseDto {
  harness: string | null;
  providerId: string | null;
  modelId: string | null;
  workerVersion: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface ActiveTaskExecutionResponseDto {
  id: string;
  taskId: string;
  taskName: string | null;
  taskStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE' | null;
  claimedAt: string;
  lastHeartbeatAt: string | null;
  runnerSessionId: string | null;
  toolCallCount: number;
  taskStatusBeforeClaim: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE';
  taskTagsBeforeClaim: ActiveTaskExecutionTagSnapshotResponseDto[];
  workerClientId: string;
  taskAssigneeActorIdBeforeClaim: string | null;
  agentActorId: string;
  stats: ExecutionStatsResponseDto | null;
}

export interface ActiveTaskExecutionListResponseDto {
  items: ActiveTaskExecutionResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StopActiveTaskExecutionDto {
  status: 'SUCCEEDED' | 'FAILED' | 'STALE' | 'CANCELLED';
  errorCode?: 'OUT_OF_QUOTA' | 'INTERRUPTED' | 'UNKNOWN' | null;
  errorMessage?: string | null;
}

export interface TaskExecutionHistoryResponseDto {
  id: string;
  taskId: string;
  taskName: string | null;
  taskStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE' | null;
  claimedAt: string;
  transitionedAt: string;
  agentActorId: string;
  workerClientId: string;
  runnerSessionId: string | null;
  toolCallCount: number;
  status: 'SUCCEEDED' | 'FAILED' | 'STALE' | 'CANCELLED';
  errorCode: 'OUT_OF_QUOTA' | 'INTERRUPTED' | 'UNKNOWN' | null;
  errorMessage: string | null;
  stats: ExecutionStatsResponseDto | null;
}

export interface WorkerGithubCredentialDto {
  projectSlug: string;
  cloneUrl: string;
  host: string;
  owner: string;
  repo: string;
  token: string;
  expiresAt: string | null;
  authType: 'pat' | 'app';
}

export interface WorkerGithubCredentialsResponseDto {
  credentials: WorkerGithubCredentialDto[];
}

export interface UpdateRunnerSessionIdDto {
  sessionId: string;
}

export interface UpdateExecutionStatsDto {
  harness?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  workerVersion?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

export interface TaskExecutionHistoryListResponseDto {
  items: TaskExecutionHistoryResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExecutionTraceResponseDto {
  executionId: string;
  sequence: number;
  source: 'worker' | 'harness';
  harness: string | null;
  runnerSessionId: string | null;
  emittedAt: string;
  receivedAt: string;
  payload: Record<string, any> | null;
}

export interface ExecutionTracesResponseDto {
  items: ExecutionTraceResponseDto[];
  lifecycle: ExecutionTraceResponseDto[];
  hasMoreBefore: boolean;
  nextAfterSequence: number;
}

export interface WorkerResponseDto {
  id: string;
  oauthClientId: string;
  workerVersion: string | null;
  lastSeenAt: string;
  harnesses: ('claude' | 'codex' | 'opencode' | 'adk' | 'githubcopilot' | 'other')[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskBlueprintDto {
  name: string;
  description: string;
  assigneeActorId?: string;
  tagNames?: string[];
  dependsOnIds?: string[];
}

export interface TaskBlueprintResponseDto {
  id: string;
  name: string;
  description: string;
  assigneeActorId?: Record<string, any> | null;
  assigneeActor?: ActorResponseDto | null;
  tags: TagResponseDto[];
  dependsOnIds: string[];
  createdByActor: ActorResponseDto;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskBlueprintListResponseDto {
  items: TaskBlueprintResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateTaskBlueprintDto {
  name?: string;
  description?: string;
  assigneeActorId?: Record<string, any> | null;
  tagNames?: string[];
  dependsOnIds?: string[];
}

export interface CreateScheduledTaskDto {
  taskBlueprintId: string;
  cronExpression: string;
  enabled?: boolean;
}

export interface ScheduledTaskResponseDto {
  id: string;
  taskBlueprintId: string;
  taskBlueprint?: TaskBlueprintResponseDto;
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: Record<string, any> | null;
  nextRunAt: string;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledTaskListResponseDto {
  items: ScheduledTaskResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateScheduledTaskDto {
  cronExpression?: string;
  enabled?: boolean;
}

export interface AuthorizationServerMetadataDto {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: ('authorization_code' | 'refresh_token')[];
  token_endpoint_auth_methods_supported: string[];
  token_endpoint_auth_signing_alg_values_supported: string[];
  code_challenge_methods_supported: string[];
  client_id_metadata_document_supported: boolean;
}

export interface ProtectedResourceMetadataResponseDto {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_name: string;
}

export type SearchResultType = 'task' | 'context_block' | 'thread' | 'tool' | 'agent' | 'project';

export interface GlobalSearchResultDto {
  id: string;
  type: SearchResultType;
  title: string;
  score: number;
  url: string;
  matchedBy: SearchStrategy[];
  matchedOn: SearchMatchField;
  excerpt: string;
  excerptIsComplete: boolean;
  commentId?: string | null;
  commentAuthor?: string | null;
}

export interface SearchSettingsDto {
  semanticEnabled: boolean;
  chunkSizeChars: number;
  chunkOverlapChars: number;
  queryInstruction: string;
  queryEmbeddingTimeoutMs: number;
  candidatesPerStrategy: number;
  semanticMinSimilarity: number;
  semanticMaxGap: number;
  keywordMinDensity: number;
  fuzzyMinSimilarity: number;
  rrfK: number;
  keywordWeight: number;
  fuzzyTitleWeight: number;
  semanticWeight: number;
  exactTitleBoost: number;
  doneTaskMultiplier: number;
  excerptMaxChars: number;
  defaultLimit: number;
}

export interface UpdateSearchSettingsDto {
  semanticEnabled?: boolean;
  chunkSizeChars?: number;
  chunkOverlapChars?: number;
  queryInstruction?: string;
  queryEmbeddingTimeoutMs?: number;
  candidatesPerStrategy?: number;
  semanticMinSimilarity?: number;
  semanticMaxGap?: number;
  keywordMinDensity?: number;
  fuzzyMinSimilarity?: number;
  rrfK?: number;
  keywordWeight?: number;
  fuzzyTitleWeight?: number;
  semanticWeight?: number;
  exactTitleBoost?: number;
  doneTaskMultiplier?: number;
  excerptMaxChars?: number;
  defaultLimit?: number;
}

export interface SearchIndexTypeStatusDto {
  type: string;
  documents: number;
  embedded: number;
}

export interface SearchIndexStatusDto {
  semanticActive: boolean;
  semanticInactiveReason?: string | null;
  embeddingModelId?: string | null;
  documents: number;
  embedded: number;
  pending: number;
  failed: number;
  lastError?: string | null;
  byType: SearchIndexTypeStatusDto[];
}

export interface UserWalkthroughStatusResponseDto {
  workerConfigured: boolean;
  agentCreated: boolean;
  taskCreated: boolean;
  projectCreated: boolean;
  projectConfigured: boolean;
  contextBlockCreated: boolean;
  threadConfigured: boolean;
  conversationModelReady: boolean;
  taskWithProjectCreated: boolean;
  onboardingDisplayMode: 'FULL_PAGE' | 'BANNER' | 'OFF';
}

export type AccessRequestHeardFrom = 'x' | 'linkedin' | 'word_of_mouth' | 'conference_tshirt' | 'other';

export interface CreateAccessRequestDto {
  email: string;
  building?: string;
  heardFrom?: AccessRequestHeardFrom;
  heardFromOther?: string;
  website?: string;
}

export interface CreateAccessRequestResponseDto {
  received: boolean;
}

export type AccessRequestStatus = 'new' | 'reviewed';

export interface AccessRequestResponseDto {
  id: string;
  email: string;
  building: string | null;
  heardFrom: AccessRequestHeardFrom | null;
  heardFromOther: string | null;
  status: AccessRequestStatus;
  submissionCount: number;
  createdAt: string;
  lastSubmittedAt: string;
  reviewedAt: string | null;
}

export interface AccessRequestListResponseDto {
  items: AccessRequestResponseDto[];
  total: number;
}

export interface UpdateAccessRequestDto {
  status: AccessRequestStatus;
}
