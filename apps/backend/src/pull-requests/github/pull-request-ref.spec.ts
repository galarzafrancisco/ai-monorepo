import { extractPullRequestRefs, parsePullRequestRef, pullRequestKey } from './pull-request-ref';

describe('extractPullRequestRefs', () => {
  it('finds each pull request once, in order, ignoring tabs, anchors and case', () => {
    const text = [
      'Opened https://github.com/Acme/api/pull/12 and',
      '(see https://github.com/acme/API/pull/12/files#diff-1),',
      'then https://github.com/acme/web.app/pull/3#issuecomment-99.',
      '[link](https://github.com/acme/api/pull/7)',
    ].join(' ');
    expect(extractPullRequestRefs(text)).toEqual([
      { owner: 'Acme', repo: 'api', number: 12 },
      { owner: 'acme', repo: 'web.app', number: 3 },
      { owner: 'acme', repo: 'api', number: 7 },
    ]);
  });

  it('ignores issues, other hosts and empty text', () => {
    expect(extractPullRequestRefs('https://github.com/acme/api/issues/12 https://gitlab.com/acme/api/pull/1')).toEqual([]);
    expect(extractPullRequestRefs('https://github.com/acme/api/pull/0')).toEqual([]);
    expect(extractPullRequestRefs(null)).toEqual([]);
  });
});

describe('parsePullRequestRef', () => {
  it('reads links and short references', () => {
    expect(parsePullRequestRef(' https://github.com/acme/api/pull/5 ')).toEqual({ owner: 'acme', repo: 'api', number: 5 });
    expect(parsePullRequestRef('acme/api#5')).toEqual({ owner: 'acme', repo: 'api', number: 5 });
    expect(parsePullRequestRef('acme/api')).toBeNull();
  });
});

describe('pullRequestKey', () => {
  it('is lower case', () => {
    expect(pullRequestKey({ owner: 'Acme', repo: 'API', number: 1 })).toBe('acme/api#1');
  });
});
