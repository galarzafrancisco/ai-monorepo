import { SearchMatchField, SearchStrategy } from '../enums';
import { SearchEntityType } from '../search.types';

/** What the query returns about the hit that best explains a result. */
export type ExcerptSource = {
  hit_strategy: SearchStrategy;
  hit_entity_type: SearchEntityType;
  hit_entity_id: string;
  hit_author: string | null;
  hit_body_length: number;
  hit_body_start: string;
  hit_body_matches: boolean | null;
  headline: string | null;
  chunk_kind: 'title' | 'body' | null;
  chunk_text: string | null;
  primary_body_length: number;
  primary_body_start: string;
};

/**
 * What to show for a result. A passage that matched is shown as it is. A
 * title match has no passage, so the start of the item stands in for one.
 * Text short enough to fit is always returned whole.
 */
export function pickExcerpt(
  row: ExcerptSource,
  maxChars: number,
): { matchedOn: SearchMatchField; text: string; isComplete: boolean } {
  const hitIsComment = row.hit_entity_type === 'comment';
  const passageMatched =
    (row.hit_strategy === SearchStrategy.SEMANTIC && row.chunk_kind === 'body') ||
    (row.hit_strategy === SearchStrategy.KEYWORD && (hitIsComment || row.hit_body_matches === true));

  if (!passageMatched) {
    return {
      matchedOn: SearchMatchField.TITLE,
      text: clip(row.primary_body_start, maxChars, row.primary_body_length > maxChars),
      isComplete: row.primary_body_length <= maxChars,
    };
  }

  const matchedOn = hitIsComment ? SearchMatchField.COMMENT : SearchMatchField.CONTENT;
  if (row.hit_body_length <= maxChars) {
    return { matchedOn, text: row.hit_body_start.trim(), isComplete: true };
  }
  const passage = row.hit_strategy === SearchStrategy.SEMANTIC ? row.chunk_text : row.headline;
  const text = passage ?? row.hit_body_start;
  return { matchedOn, text: clip(text, maxChars, text.length > maxChars), isComplete: false };
}

function clip(text: string, maxChars: number, truncated: boolean): string {
  const trimmed = text.trim();
  if (!truncated) {
    return trimmed;
  }
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxChars / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()} …`;
}
