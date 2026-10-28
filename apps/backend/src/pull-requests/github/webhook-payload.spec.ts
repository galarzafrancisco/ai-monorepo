import { pullRequestTargetsOf } from './webhook-payload';

const repository = { name: 'api', owner: { login: 'acme' } };

describe('pullRequestTargetsOf', () => {
  it('reads pull request and review events by number', () => {
    expect(pullRequestTargetsOf('pull_request', { repository, pull_request: { number: 4 } })).toEqual([
      { owner: 'acme', repo: 'api', numbers: [4] },
    ]);
    expect(pullRequestTargetsOf('pull_request_review', { repository, pull_request: { number: 5 } })[0].numbers).toEqual([5]);
  });

  it('only takes comments on pull requests', () => {
    expect(pullRequestTargetsOf('issue_comment', { repository, issue: { number: 6 } })).toEqual([]);
    expect(pullRequestTargetsOf('issue_comment', { repository, issue: { number: 6, pull_request: {} } })[0].numbers).toEqual([6]);
  });

  it('reads CI events by pull request and head commit', () => {
    expect(
      pullRequestTargetsOf('check_run', { repository, check_run: { head_sha: 'abc', pull_requests: [{ number: 7 }] } }),
    ).toEqual([{ owner: 'acme', repo: 'api', numbers: [7], headSha: 'abc' }]);
    expect(pullRequestTargetsOf('status', { repository, sha: 'def' })).toEqual([{ owner: 'acme', repo: 'api', headSha: 'def' }]);
  });

  it('ignores other events and payloads without a repository', () => {
    expect(pullRequestTargetsOf('push', { repository })).toEqual([]);
    expect(pullRequestTargetsOf('ping', {})).toEqual([]);
    expect(pullRequestTargetsOf(undefined, null)).toEqual([]);
  });
});
