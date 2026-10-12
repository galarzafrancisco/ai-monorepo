import { createHash } from 'node:crypto';
import { SearchEntityType } from '../search.types';
import { chunkText } from './chunker';
import { SearchSettings } from './search-settings';

/** An item with more passages than this is embedded only up to here. */
const MAX_CHUNKS_PER_DOCUMENT = 500;
/** Bump to re-embed everything after a change to how passages are built. */
const CHUNKING_VERSION = 1;

export type PlannableDocument = {
  entity_type: SearchEntityType;
  title: string;
  search_title: string;
  body: string;
};

export type PlannedChunk = {
  kind: 'title' | 'body';
  ordinal: number;
  /** Shown as the excerpt. */
  text: string;
  /** What the model sees: the passage with the context it would otherwise lack. */
  embedText: string;
  textHash: string;
};

/**
 * What an index row's embeddings were built with. A row whose stored
 * fingerprint differs from md5(content_hash || this) is out of date, so
 * changing the model or the chunk settings re-embeds everything by itself.
 */
export function embeddingConfigKey(modelKey: string, settings: SearchSettings): string {
  return [modelKey, settings.chunkSizeChars, settings.chunkOverlapChars, CHUNKING_VERSION].join('|');
}

/** The passages one index row is embedded as: its title, then its text in order. */
export function planChunks(
  document: PlannableDocument,
  settings: Pick<SearchSettings, 'chunkSizeChars' | 'chunkOverlapChars'>,
): PlannedChunk[] {
  const planned: PlannedChunk[] = [];
  const add = (kind: PlannedChunk['kind'], text: string, embedText: string) => {
    planned.push({
      kind,
      ordinal: planned.filter((chunk) => chunk.kind === kind).length,
      text,
      embedText,
      textHash: createHash('md5').update(embedText).digest('hex'),
    });
  };

  // A title is its own passage: a short query is often closest to a short title.
  if (document.search_title.trim()) {
    add('title', document.search_title, document.search_title);
  }

  const isComment = document.entity_type === 'comment';
  const chunks = chunkText(document.body, {
    maxChars: settings.chunkSizeChars,
    overlapChars: settings.chunkOverlapChars,
  }).slice(0, MAX_CHUNKS_PER_DOCUMENT);

  for (const chunk of chunks) {
    // A passage alone often does not say what it is about; its title and headings do.
    const context = isComment
      ? `Comment on task: ${document.title}`
      : [document.title, ...chunk.headingPath].join(' > ');
    add('body', chunk.text, `${context}\n\n${chunk.text}`);
  }
  return planned;
}
