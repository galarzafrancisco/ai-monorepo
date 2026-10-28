import { issueTargetsOf } from './webhook-payload';

const repository = { name: 'api', owner: { login: 'acme' } };

describe('issueTargetsOf', () => {
  it('reads issue and comment events by number', () => {
    expect(issueTargetsOf('issues', { repository, issue: { number: 4 } })).toEqual([{ owner: 'acme', repo: 'api', numbers: [4] }]);
    expect(issueTargetsOf('issue_comment', { repository, issue: { number: 6, pull_request: {} } })[0].numbers).toEqual([6]);
  });

  it('ignores other events and incomplete payloads', () => {
    expect(issueTargetsOf('pull_request', { repository, pull_request: { number: 4 } })).toEqual([]);
    expect(issueTargetsOf('issues', { repository })).toEqual([]);
    expect(issueTargetsOf('issues', { issue: { number: 4 } })).toEqual([]);
    expect(issueTargetsOf(undefined, null)).toEqual([]);
  });
});
