import { extractIssueRefs, issueKey, issueUrl, parseIssueRef } from './issue-ref';

describe('extractIssueRefs', () => {
  it('finds each issue once, in order, including comment anchors', () => {
    const text =
      'See https://github.com/acme/api/issues/12 and https://github.com/Acme/API/issues/12#issuecomment-1, then https://github.com/acme/web/issues/3.';
    expect(extractIssueRefs(text)).toEqual([
      { owner: 'acme', repo: 'api', number: 12 },
      { owner: 'acme', repo: 'web', number: 3 },
    ]);
  });

  it('ignores pull requests, other pages and number zero', () => {
    expect(extractIssueRefs('https://github.com/acme/api/pull/12')).toEqual([]);
    expect(extractIssueRefs('https://github.com/acme/api/issues')).toEqual([]);
    expect(extractIssueRefs('https://github.com/acme/api/issues/0')).toEqual([]);
  });

  it('reads GitHub Enterprise links only on known hosts', () => {
    const text = 'https://github.acme.com/team/api/issues/4 https://git.other.dev/team/api/issues/5';
    expect(extractIssueRefs(text)).toEqual([]);
    expect(extractIssueRefs(text, ['github.acme.com'])).toEqual([
      { host: 'github.acme.com', owner: 'team', repo: 'api', number: 4 },
    ]);
    expect(extractIssueRefs(text, 'any')).toHaveLength(2);
  });
});

describe('parseIssueRef', () => {
  it('reads links and short references', () => {
    expect(parseIssueRef('https://github.com/acme/api/issues/7')).toEqual({ owner: 'acme', repo: 'api', number: 7 });
    expect(parseIssueRef('acme/api#7')).toEqual({ owner: 'acme', repo: 'api', number: 7 });
    expect(parseIssueRef('github.acme.com/acme/api#7', ['github.acme.com'])).toEqual({
      host: 'github.acme.com',
      owner: 'acme',
      repo: 'api',
      number: 7,
    });
  });

  it('rejects unknown hosts and other text', () => {
    expect(parseIssueRef('github.other.com/acme/api#7')).toBeNull();
    expect(parseIssueRef('acme/api#0')).toBeNull();
    expect(parseIssueRef('not an issue')).toBeNull();
  });
});

describe('issueKey and issueUrl', () => {
  it('keys are lower case with the host on a GitHub Enterprise', () => {
    expect(issueKey({ owner: 'Acme', repo: 'API', number: 3 })).toBe('acme/api#3');
    expect(issueKey({ host: 'GitHub.Acme.com', owner: 'Acme', repo: 'API', number: 3 })).toBe('github.acme.com/acme/api#3');
    expect(issueUrl({ host: 'github.acme.com', owner: 'a', repo: 'b', number: 1 })).toBe('https://github.acme.com/a/b/issues/1');
  });
});
