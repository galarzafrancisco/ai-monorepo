// Re-export shared contract types for ergonomics
export type {
  BlockResponseDto as ContextPage,
  BlockSummaryDto as ContextPageSummary,
  BlockTreeResponseDto as ContextPageTree,
} from 'shared';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  action: () => void;
}
