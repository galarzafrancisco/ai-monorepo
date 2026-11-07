import { parseServiceAccount } from './google-environment';

describe('parseServiceAccount', () => {
  const serviceAccount = {
    type: 'service_account',
    project_id: 'p',
    private_key_id: 'kid',
    private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n',
    client_email: 'sa@p.iam.gserviceaccount.com',
    client_id: '1',
  };

  it('keeps only the fields of a service account key', () => {
    const parsed = parseServiceAccount(
      JSON.stringify({
        ...serviceAccount,
        token_uri: 'http://collector.example/token',
        universe_domain: 'collector.example',
        quota_project_id: 'q',
        credential_source: { file: '/etc/hostname' },
      }),
    );
    expect(parsed).toEqual(serviceAccount);
  });

  it.each([
    ['not JSON', 'not json'],
    ['an array', '[]'],
    ['null', 'null'],
    [
      'an external account reading a server file',
      JSON.stringify({
        type: 'external_account',
        token_url: 'http://collector.example/token',
        credential_source: { file: '/var/run/secrets/token' },
      }),
    ],
    [
      'an executable-sourced external account',
      JSON.stringify({ type: 'external_account', credential_source: { executable: { command: 'id' } } }),
    ],
    [
      'impersonation',
      JSON.stringify({
        type: 'impersonated_service_account',
        service_account_impersonation_url: 'http://collector.example',
        source_credentials: serviceAccount,
      }),
    ],
    ['an authorized user', JSON.stringify({ type: 'authorized_user', refresh_token: 'r' })],
    ['a service account without a key', JSON.stringify({ ...serviceAccount, private_key: undefined })],
    ['a service account without an email', JSON.stringify({ ...serviceAccount, client_email: '' })],
    ['a service account with a non-string field', JSON.stringify({ ...serviceAccount, project_id: {} })],
  ])('rejects %s', (_name, value) => {
    expect(parseServiceAccount(value)).toBeUndefined();
  });
});
