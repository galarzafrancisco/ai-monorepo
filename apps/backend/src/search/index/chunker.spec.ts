import { chunkText } from './chunker';

const options = { maxChars: 200, overlapChars: 20 };

describe('chunkText', () => {
  it('returns nothing for empty text', () => {
    expect(chunkText('', options)).toEqual([]);
    expect(chunkText('  \n\n ', options)).toEqual([]);
  });

  it('keeps short text as one passage', () => {
    expect(chunkText('Rotated the signing key.', options)).toEqual([
      { text: 'Rotated the signing key.', headingPath: [] },
    ]);
  });

  it('starts a new passage at every heading and records the headings above it', () => {
    const chunks = chunkText(
      ['Intro line.', '# Deploy', 'Use the pipeline.', '## Rollback', 'Revert the commit.', '# Monitor', 'Watch the logs.'].join('\n'),
      options,
    );

    expect(chunks).toEqual([
      { text: 'Intro line.', headingPath: [] },
      { text: '# Deploy\n\nUse the pipeline.', headingPath: ['Deploy'] },
      { text: '## Rollback\n\nRevert the commit.', headingPath: ['Deploy', 'Rollback'] },
      { text: '# Monitor\n\nWatch the logs.', headingPath: ['Monitor'] },
    ]);
  });

  it('skips a heading with nothing under it', () => {
    const chunks = chunkText('# Empty\n\n# Full\nText.', options);
    expect(chunks.map((chunk) => chunk.headingPath)).toEqual([['Full']]);
  });

  it('does not treat a # line inside a code block as a heading', () => {
    const chunks = chunkText('# Setup\n```bash\n# install\nnpm ci\n```', options);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toEqual(['Setup']);
    expect(chunks[0].text).toContain('# install');
  });

  it('packs whole paragraphs up to the size limit', () => {
    const paragraph = 'word '.repeat(20).trim(); // 99 characters
    const chunks = chunkText([paragraph, paragraph, paragraph].join('\n\n'), options);

    expect(chunks.map((chunk) => chunk.text)).toEqual([`${paragraph}\n\n${paragraph}`, paragraph]);
  });

  it('cuts an over-long paragraph at a sentence boundary and overlaps the pieces', () => {
    const sentence = 'The quick brown fox jumps over the lazy dog again. ';
    const chunks = chunkText(sentence.repeat(10).trim(), options);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(options.maxChars);
    }
    expect(chunks[0].text.endsWith('again.')).toBe(true);
    // The second piece starts inside the first one's tail.
    expect(chunks[0].text).toContain(chunks[1].text.slice(0, 10));
  });

  it('keeps a heading with the long block it introduces', () => {
    const block = 'x'.repeat(500);
    const chunks = chunkText(`## Diagram\n\n${block}`, options);

    expect(chunks[0].text.startsWith('## Diagram')).toBe(true);
    expect(chunks.every((chunk) => chunk.text !== '## Diagram')).toBe(true);
  });

  it('always terminates, even when the overlap is as long as the passage', () => {
    const chunks = chunkText('y'.repeat(1000), { maxChars: 10, overlapChars: 10 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.map((chunk) => chunk.text).join('').length).toBeGreaterThanOrEqual(1000);
  });
});
