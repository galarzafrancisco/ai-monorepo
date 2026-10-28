import { webhookCoverageOf } from './webhook-coverage';

describe('webhookCoverageOf', () => {
  const repository = { name: 'api', owner: { login: 'Acme' } };

  it('covers one repository for a repository webhook, including its ping', () => {
    expect(webhookCoverageOf('repository', { zen: 'hi', repository })).toEqual({ owner: 'Acme', repo: 'api' });
  });

  it('covers the whole organization for an organization webhook', () => {
    expect(webhookCoverageOf('organization', { organization: { login: 'acme' } })).toEqual({ owner: 'acme', repo: null });
    expect(webhookCoverageOf('organization', { repository, organization: { login: 'acme' } })).toEqual({ owner: 'acme', repo: null });
  });

  it('covers the installation account for a GitHub App webhook', () => {
    expect(webhookCoverageOf('integration', { repository, installation: { account: { login: 'acme' } } })).toEqual({
      owner: 'acme',
      repo: null,
    });
    expect(webhookCoverageOf('integration', { zen: 'hi', hook: { type: 'App' } })).toBeNull();
  });

  it('falls back to the payload without the header', () => {
    expect(webhookCoverageOf(undefined, { repository })).toEqual({ owner: 'Acme', repo: 'api' });
    expect(webhookCoverageOf(undefined, { organization: { login: 'acme' } })).toEqual({ owner: 'acme', repo: null });
    expect(webhookCoverageOf(undefined, {})).toBeNull();
  });
});
