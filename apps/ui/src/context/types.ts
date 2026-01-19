// Re-export shared contract types for ergonomics
export type {
  PageResponseDto as ContextPage,
  PageSummaryDto as ContextPageSummary,
  PageTreeResponseDto as ContextPageTree,
} from 'shared';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  action: () => void;
}
