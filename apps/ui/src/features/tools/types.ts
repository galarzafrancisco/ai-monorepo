// Re-export types from v2 shared package for ergonomics.
// Terminology note: UI "Tools" map to MCP servers in backend/domain APIs.
export type {
  ServerResponseDto as Tool,
  ScopeResponseDto as ToolScope,
  ConnectionResponseDto as ToolClient,
  ServerListResponseDto as ToolListResponse,
  AuthJourneyResponseDto as ToolAuthorization,
} from "@taico/client/v2";
