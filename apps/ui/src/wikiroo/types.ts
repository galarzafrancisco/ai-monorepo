// Re-export shared contract types for ergonomics
export type {
  PageResponseDto as WikiPage,
  PageSummaryDto as WikiPageSummary,
} from 'shared';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  action: () => void;
}
