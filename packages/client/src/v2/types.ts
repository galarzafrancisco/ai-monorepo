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

export interface CreateProjectDto {
  slug: string;
  description?: string;
  repoUrl?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface PatchProjectDto {
  description?: string;
  repoUrl?: string;
}

export interface RegisterClientDto {
  redirect_uris: string[];
  token_endpoint_auth_method: 'none' | 'client_secret_basic';
  grant_types: ('authorization_code' | 'refresh_token')[];
  response_types: 'code'[];
  client_name: string;
  scope?: string[];
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
  token_endpoint_auth_method: 'none' | 'client_secret_basic';
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
}

export interface GetConsentMetadataResponseDto {
  id: string;
  status: 'CLIENT_NOT_REGISTERED' | 'CLIENT_REGISTERED' | 'AUTHORIZATION_REQUEST_STARTED' | 'USER_CONSENT_OK' | 'USER_CONSENT_REJECTED' | 'WAITING_ON_DOWNSTREAM_AUTH' | 'AUTHORIZATION_CODE_ISSUED' | 'AUTHORIZATION_CODE_EXCHANGED';
  scopes?: string[];
  resource?: string;
  server: any;
  client: any;
  redirectUri: string;
  createdAt: string;
}

export interface TokenRequestDto {
  grant_type: 'authorization_code' | 'refresh_token';
  client_id: string;
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
  hasSeenWalkthrough: boolean;
}

export interface LoginResponseDto {
  user: any;
  expiresIn: number;
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
  actor: any | null;
  mcpAuthorizationFlow: any;
  connectionAuthorizationFlows: ConnectionFlowResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerDto {
  providedId: string;
  name: string;
  description: string;
  type: 'http' | 'stdio';
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
  commenterActor?: any | null;
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
  assignee?: Record<string, any> | null;
  assigneeActor?: any | null;
  sessionId?: string | null;
  comments: CommentResponseDto[];
  artefacts: ArtefactResponseDto[];
  inputRequests: InputRequestResponseDto[];
  tags: TagResponseDto[];
  createdByActor: any;
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

export interface TaskSearchResultDto {
  id: string;
  name: string;
  score: number;
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
  actor?: any | null;
  parentTaskId: string;
  parentTask?: any | null;
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
  assigneeActor?: any | null;
  createdByActor: any;
  tags: TagResponseDto[];
  commentCount: number;
  inputRequests: InputRequestResponseDto[];
  updatedAt: string;
}

export interface ContextBlockSummaryResponseDto {
  id: string;
  title: string;
}

export interface ThreadResponseDto {
  id: string;
  title: string;
  chatSessionId: string | null;
  createdByActor: any;
  parentTaskId?: string | null;
  stateContextBlockId: string;
  tasks: TaskSummaryResponseDto[];
  referencedContextBlocks: ContextBlockSummaryResponseDto[];
  tags: MetaTagResponseDto[];
  participants: ActorResponseDto[];
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
  chatSessionId: string | null;
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

export interface ReferenceContextBlockDto {
  contextBlockId: string;
}

export interface AddParticipantDto {
  actorId: string;
}

export interface ThreadStateResponseDto {
  content: string;
}

export interface UpdateThreadStateDto {
  content: string;
}

export interface AppendThreadStateDto {
  content: string;
}

export interface CreateThreadMessageDto {
  content: string;
}

export interface ThreadMessageResponseDto {
  id: string;
  threadId: string;
  content: string;
  createdByActorId?: string | null;
  createdByActor?: any | null;
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
  scopes: string[];
  expirationSeconds?: number;
}

export interface AgentExecutionTokenResponseDto {
  token: string;
  scopes: string[];
  expiresAt: string;
  agentSlug: string;
  requestedByClientId: string;
}

export interface CreateChatProviderDto {
  name: string;
  type: 'openai';
  secretId?: string;
}

export interface ChatProviderResponseDto {
  id: string;
  name: string;
  type: 'openai';
  secretId?: string | null;
  isActive: boolean;
  isConfigured: boolean;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateChatProviderDto {
  name?: string;
  secretId?: string;
  apiKey?: string;
}

export interface SetActiveChatProviderDto {
  providerId: string;
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

export interface ExecutionResponseDto {
  id: string;
  taskId: string;
  taskName?: string | null;
  agentActorId: string;
  agentSlug?: string | null;
  agentName?: string | null;
  status: 'READY' | 'CLAIMED' | 'RUNNING' | 'STOP_REQUESTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'STALE';
  requestedAt: string;
  claimedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  workerSessionId?: string | null;
  leaseExpiresAt?: string | null;
  stopRequestedAt?: string | null;
  failureReason?: string | null;
  triggerReason?: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionListResponseDto {
  items: ExecutionResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  assigneeActor?: any | null;
  tags: TagResponseDto[];
  dependsOnIds: string[];
  createdByActor: any;
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
  taskBlueprint?: any;
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
  code_challenge_methods_supported: string[];
}

export interface ProtectedResourceMetadataResponseDto {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_name: string;
}

export interface GlobalSearchResultDto {
  id: string;
  type: 'task' | 'context_block' | 'agent' | 'project' | 'tag' | 'tool';
  title: string;
  score: number;
  url: string;
}
