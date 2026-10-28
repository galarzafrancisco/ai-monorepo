import { describe, expect, it } from 'vitest';
import { issueKey, parseIssueUrl, pullRequestUrlOf } from './issueLinks';

describe('parseIssueUrl', () => {
  it('reads issue links and their comment anchors', () => {
    expect(parseIssueUrl('https://github.com/acme/api/issues/12')).toEqual({ owner: 'acme', repo: 'api', number: 12 });
    expect(parseIssueUrl('https://github.com/acme/api/issues/12#issuecomment-1')?.number).toBe(12);
  });

  it('rejects other links', () => {
    expect(parseIssueUrl('https://github.com/acme/api/pull/12')).toBeNull();
    expect(parseIssueUrl('https://github.com/acme/api/issues')).toBeNull();
    expect(parseIssueUrl('https://github.com/acme/api/issues/12x')).toBeNull();
    expect(parseIssueUrl('https://github.com/acme/api/issues/0')).toBeNull();
  });

  it('reads links on a GitHub Enterprise, with their host', () => {
    expect(parseIssueUrl('https://GitHub.Acme.com/acme/api/issues/4')).toEqual({ host: 'github.acme.com', owner: 'acme', repo: 'api', number: 4 });
  });
});

describe('issueKey', () => {
  it('is lower case', () => {
    expect(issueKey({ owner: 'Acme', repo: 'API', number: 3 })).toBe('acme/api#3');
    expect(issueKey({ host: 'github.acme.com', owner: 'Acme', repo: 'API', number: 3 })).toBe('github.acme.com/acme/api#3');
  });
});

describe('pullRequestUrlOf', () => {
  it('points at the pull request with the same number', () => {
    expect(pullRequestUrlOf({ owner: 'a', repo: 'b', number: 3 })).toBe('https://github.com/a/b/pull/3');
    expect(pullRequestUrlOf({ host: 'github.acme.com', owner: 'a', repo: 'b', number: 3 })).toBe('https://github.acme.com/a/b/pull/3');
  });
});
