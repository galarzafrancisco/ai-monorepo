/**
 * Splits text into passages small enough to embed well and to show as a
 * search excerpt. Markdown-aware: a passage never crosses a heading, and each
 * passage remembers the headings above it.
 */

export type TextChunk = {
  /** The passage exactly as it appears in the source. */
  text: string;
  /** Headings the passage sits under, outermost first. */
  headingPath: string[];
};

export type ChunkOptions = {
  /** Target passage size in characters. */
  maxChars: number;
  /** Characters repeated between consecutive pieces of one over-long paragraph. */
  overlapChars: number;
};

type Section = { headingPath: string[]; lines: string[] };

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;

export function chunkText(text: string, options: ChunkOptions): TextChunk[] {
  const maxChars = Math.max(1, Math.trunc(options.maxChars));
  const overlapChars = Math.max(0, Math.min(Math.trunc(options.overlapChars), Math.floor(maxChars / 2)));

  const chunks: TextChunk[] = [];
  for (const section of splitSections(text)) {
    const heading = section.headingPath.at(-1);
    const body = section.lines.join('\n').trim();
    // The heading line stays in the passage, so an excerpt reads as it does in the source.
    const sectionText = [heading ? section.headingLine : null, body].filter(Boolean).join('\n\n');
    if (!body) {
      continue;
    }
    for (const piece of packParagraphs(sectionText, maxChars, overlapChars)) {
      chunks.push({ text: piece, headingPath: section.headingPath });
    }
  }
  return chunks;
}

type SectionWithLine = Section & { headingLine: string | null };

function splitSections(text: string): SectionWithLine[] {
  const sections: SectionWithLine[] = [];
  let current: SectionWithLine = { headingPath: [], headingLine: null, lines: [] };
  const stack: Array<{ level: number; title: string }> = [];
  let inFence = false;

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence;
    }
    // A "# comment" inside a code block is not a heading.
    const match = inFence ? null : HEADING.exec(line);
    if (!match) {
      current.lines.push(line);
      continue;
    }
    sections.push(current);
    const level = match[1].length;
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack.push({ level, title: match[2] });
    current = {
      headingPath: stack.map((entry) => entry.title),
      headingLine: line.trim(),
      lines: [],
    };
  }
  sections.push(current);
  return sections;
}

/** Packs whole paragraphs into passages up to maxChars; only an over-long paragraph is cut. */
function packParagraphs(text: string, maxChars: number, overlapChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const pieces: string[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) {
      pieces.push(current.trim());
    }
    current = '';
  };

  for (const paragraph of text.split(/\n{2,}/)) {
    if (!paragraph.trim()) {
      continue;
    }
    if (paragraph.length > maxChars) {
      // A short lead-in (a heading, a one-line intro) stays with what it introduces.
      const leadIn = current && current.length < maxChars / 4 ? `${current}\n\n` : '';
      if (leadIn) {
        current = '';
      }
      flush();
      pieces.push(...cutLongParagraph(leadIn + paragraph, maxChars, overlapChars));
      continue;
    }
    if (current && current.length + 2 + paragraph.length > maxChars) {
      flush();
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();
  return pieces;
}

/** Cuts at the last line, sentence or word boundary that fits, and repeats the tail as overlap. */
function cutLongParagraph(paragraph: string, maxChars: number, overlapChars: number): string[] {
  const pieces: string[] = [];
  let start = 0;
  while (start < paragraph.length) {
    let end = Math.min(start + maxChars, paragraph.length);
    if (end < paragraph.length) {
      end = start + bestBreak(paragraph.slice(start, end));
    }
    const piece = paragraph.slice(start, end).trim();
    if (piece) {
      pieces.push(piece);
    }
    if (end >= paragraph.length) {
      break;
    }
    // Always advance, even when the overlap is as long as the piece.
    start = Math.max(end - overlapChars, start + 1);
  }
  return pieces;
}

function bestBreak(window: string): number {
  // A break in the first half would make a needlessly short passage.
  const earliest = Math.floor(window.length / 2);
  for (const boundary of ['\n', '. ', '? ', '! ', '; ', ', ', ' ']) {
    const index = window.lastIndexOf(boundary);
    if (index >= earliest) {
      return index + boundary.length;
    }
  }
  return window.length;
}
