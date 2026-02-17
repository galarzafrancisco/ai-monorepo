// Re-export types from shared package
export type {
  ThreadResponseDto as Thread,
  ThreadListItemResponseDto as ThreadListItem,
  ThreadMessageResponseDto as Message,
} from "@taico/client";

import {
  ActorResponseDto
} from "@taico/client";

export const ActorType = ActorResponseDto.type;