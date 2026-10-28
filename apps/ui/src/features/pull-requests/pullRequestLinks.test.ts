import { describe, expect, it } from 'vitest';
import { parsePullRequestUrl, pullRequestKey, splitLinks } from './pullRequestLinks';

describe('parsePullRequestUrl', () => {
  it('reads pull request links, their tabs and anchors', () => {
    expect(parsePullRequestUrl('https://github.com/acme/api/pull/12')).toEqual({ owner: 'acme', repo: 'api', number: 12 });
    expect(parsePullRequestUrl('https://github.com/acme/api/pull/12/files#diff')).toEqual({ owner: 'acme', repo: 'api', number: 12 });
    expect(parsePullRequestUrl('https://github.com/acme/api/pull/12#issuecomment-1')?.number).toBe(12);
  });

  it('rejects other links', () => {
    expect(parsePullRequestUrl('https://github.com/acme/api/issues/12')).toBeNull();
    expect(parsePullRequestUrl('https://github.com/acme/api/pull/123x')).toBeNull();
    expect(parsePullRequestUrl('https://example.com/acme/api/pull/1')).toBeNull();
  });
});

describe('pullRequestKey', () => {
  it('is lower case', () => {
    expect(pullRequestKey({ owner: 'Acme', repo: 'API', number: 3 })).toBe('acme/api#3');
  });
});

describe('splitLinks', () => {
  it('finds links and leaves sentence punctuation out', () => {
    expect(splitLinks('See https://github.com/a/b/pull/1. And (https://x.dev/y)!')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', url: 'https://github.com/a/b/pull/1' },
      { kind: 'text', text: '. And (' },
      { kind: 'link', url: 'https://x.dev/y' },
      { kind: 'text', text: ')!' },
    ]);
  });

  it('returns plain text untouched', () => {
    expect(splitLinks('no links here')).toEqual([{ kind: 'text', text: 'no links here' }]);
  });
});
