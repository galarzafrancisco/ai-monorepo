import { embeddingConfigKey, planChunks } from './chunk-plan';
import { DEFAULT_SEARCH_SETTINGS } from './search-settings';

const settings = { chunkSizeChars: 200, chunkOverlapChars: 20 };

describe('planChunks', () => {
  it('embeds the title on its own and each passage with its title and headings', () => {
    const planned = planChunks(
      {
        entity_type: 'context_block',
        title: 'Deployment Guide',
        search_title: 'Deployment Guide',
        body: '# Rollback\nRevert the commit.',
      },
      settings,
    );

    expect(planned.map(({ kind, ordinal, text, embedText }) => ({ kind, ordinal, text, embedText }))).toEqual([
      { kind: 'title', ordinal: 0, text: 'Deployment Guide', embedText: 'Deployment Guide' },
      {
        kind: 'body',
        ordinal: 0,
        text: '# Rollback\n\nRevert the commit.',
        embedText: 'Deployment Guide > Rollback\n\n# Rollback\n\nRevert the commit.',
      },
    ]);
  });

  it('gives a comment no title passage and says which task it is on', () => {
    const planned = planChunks(
      {
        entity_type: 'comment',
        title: 'Fix login loop',
        search_title: '',
        body: 'Safari dropped the cookie.',
      },
      settings,
    );

    expect(planned).toHaveLength(1);
    expect(planned[0].kind).toBe('body');
    expect(planned[0].text).toBe('Safari dropped the cookie.');
    expect(planned[0].embedText).toBe('Comment on task: Fix login loop\n\nSafari dropped the cookie.');
  });

  it('plans only the title for an item without text', () => {
    const planned = planChunks(
      { entity_type: 'task', title: 'Buy USD', search_title: 'Buy USD', body: '' },
      settings,
    );
    expect(planned.map((chunk) => chunk.kind)).toEqual(['title']);
  });

  it('hashes what the model sees, so renaming an item re-embeds its passages', () => {
    const body = 'Same text.';
    const [, before] = planChunks(
      { entity_type: 'task', title: 'Old name', search_title: 'Old name', body },
      settings,
    );
    const [, after] = planChunks(
      { entity_type: 'task', title: 'New name', search_title: 'New name', body },
      settings,
    );

    expect(before.text).toBe(after.text);
    expect(before.textHash).not.toBe(after.textHash);
  });
});

describe('embeddingConfigKey', () => {
  it('changes with the model and with the chunk settings, and with nothing else', () => {
    const base = embeddingConfigKey('provider:model-a', DEFAULT_SEARCH_SETTINGS);

    expect(embeddingConfigKey('provider:model-b', DEFAULT_SEARCH_SETTINGS)).not.toBe(base);
    expect(
      embeddingConfigKey('provider:model-a', { ...DEFAULT_SEARCH_SETTINGS, chunkSizeChars: 800 }),
    ).not.toBe(base);
    expect(
      embeddingConfigKey('provider:model-a', { ...DEFAULT_SEARCH_SETTINGS, chunkOverlapChars: 0 }),
    ).not.toBe(base);
    expect(
      embeddingConfigKey('provider:model-a', { ...DEFAULT_SEARCH_SETTINGS, rrfK: 5, defaultLimit: 3 }),
    ).toBe(base);
  });
});
