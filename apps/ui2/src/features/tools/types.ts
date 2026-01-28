// Re-export types from shared package for ergonomics
export type {
  ServerResponseDto as Tool,
  ScopeResponseDto as ToolScope,
  ConnectionResponseDto as ToolClient,
  ServerListResponseDto as ToolListResponse,
  AuthJourneyResponseDto as ToolAuthorization,
} from 'shared';
