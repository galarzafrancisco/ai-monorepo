// Re-export types from v2 shared package
export type {
  ThreadResponseDto as Thread,
  ThreadListItemResponseDto as ThreadListItem,
  ThreadMessageResponseDto as Message,
  ActorResponseDto,
} from "@taico/client/v2";

// Actor type constants
export const ActorType = {
  HUMAN: 'human' as const,
  AGENT: 'agent' as const,
};
