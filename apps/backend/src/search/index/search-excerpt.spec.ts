import { SearchMatchField, SearchStrategy } from '../enums';
import { ExcerptSource, pickExcerpt } from './search-excerpt';

const longBody = 'Opening sentence of the block. ' + 'More text follows here. '.repeat(40);

function source(overrides: Partial<ExcerptSource>): ExcerptSource {
  return {
    hit_strategy: SearchStrategy.KEYWORD,
    hit_entity_type: 'context_block',
    hit_entity_id: 'hit-id',
    hit_author: null,
    hit_body_length: longBody.length,
    hit_body_start: longBody.slice(0, 100),
    hit_body_matches: false,
    headline: null,
    chunk_kind: null,
    chunk_text: null,
    primary_body_length: longBody.length,
    primary_body_start: longBody.slice(0, 100),
    ...overrides,
  };
}

describe('pickExcerpt', () => {
  it('shows the start of the item, marked partial, when only the title matched', () => {
    for (const hit of [
      { hit_strategy: SearchStrategy.FUZZY_TITLE },
      { hit_strategy: SearchStrategy.SEMANTIC, chunk_kind: 'title' as const, chunk_text: 'Title' },
      { hit_strategy: SearchStrategy.KEYWORD, hit_body_matches: false },
    ]) {
      const excerpt = pickExcerpt(source(hit), 100);

      expect(excerpt.matchedOn).toBe(SearchMatchField.TITLE);
      expect(excerpt.text.startsWith('Opening sentence of the block.')).toBe(true);
      expect(excerpt.text.endsWith('…')).toBe(true);
      expect(excerpt.isComplete).toBe(false);
    }
  });

  it('returns a short item whole on a title match', () => {
    const excerpt = pickExcerpt(
      source({
        hit_strategy: SearchStrategy.FUZZY_TITLE,
        primary_body_length: 12,
        primary_body_start: 'Short body.\n',
      }),
      100,
    );

    expect(excerpt).toEqual({ matchedOn: SearchMatchField.TITLE, text: 'Short body.', isComplete: true });
  });

  it('returns an empty, complete excerpt for an item without text', () => {
    const excerpt = pickExcerpt(
      source({ hit_strategy: SearchStrategy.FUZZY_TITLE, primary_body_length: 0, primary_body_start: '' }),
      100,
    );
    expect(excerpt).toEqual({ matchedOn: SearchMatchField.TITLE, text: '', isComplete: true });
  });

  it('shows the passage that matched by meaning, marked partial', () => {
    const excerpt = pickExcerpt(
      source({
        hit_strategy: SearchStrategy.SEMANTIC,
        chunk_kind: 'body',
        chunk_text: '## Rollback\n\nRevert the commit.',
      }),
      100,
    );

    expect(excerpt).toEqual({
      matchedOn: SearchMatchField.CONTENT,
      text: '## Rollback\n\nRevert the commit.',
      isComplete: false,
    });
  });

  it('shows the keyword fragments from a long text', () => {
    const excerpt = pickExcerpt(
      source({ hit_body_matches: true, headline: 'the signing key … rotated nightly' }),
      100,
    );

    expect(excerpt).toEqual({
      matchedOn: SearchMatchField.CONTENT,
      text: 'the signing key … rotated nightly',
      isComplete: false,
    });
  });

  it('returns text that fits whole instead of a passage of it', () => {
    const excerpt = pickExcerpt(
      source({
        hit_strategy: SearchStrategy.SEMANTIC,
        chunk_kind: 'body',
        chunk_text: 'Second paragraph.',
        hit_body_length: 34,
        hit_body_start: 'First paragraph.\n\nSecond paragraph.',
      }),
      100,
    );

    expect(excerpt).toEqual({
      matchedOn: SearchMatchField.CONTENT,
      text: 'First paragraph.\n\nSecond paragraph.',
      isComplete: true,
    });
  });

  it('reports a matching comment as a comment', () => {
    const excerpt = pickExcerpt(
      source({
        hit_entity_type: 'comment',
        hit_body_length: 26,
        hit_body_start: 'Safari dropped the cookie.',
      }),
      100,
    );

    expect(excerpt).toEqual({
      matchedOn: SearchMatchField.COMMENT,
      text: 'Safari dropped the cookie.',
      isComplete: true,
    });
  });
});
