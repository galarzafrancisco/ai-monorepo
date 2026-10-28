import { parseGithubRepoUrl } from './github-repo-ref';

describe('parseGithubRepoUrl', () => {
  it.each([
    ['https://github.com/acme/api', { host: 'github.com', owner: 'acme', repo: 'api' }],
    ['https://github.com/acme/api.git', { host: 'github.com', owner: 'acme', repo: 'api' }],
    ['https://github.com/acme/api/pull/12', { host: 'github.com', owner: 'acme', repo: 'api' }],
    ['git@github.com:acme/api.git', { host: 'github.com', owner: 'acme', repo: 'api' }],
    ['ssh://git@github.com/acme/api.git', { host: 'github.com', owner: 'acme', repo: 'api' }],
    ['  https://GitHub.com/Acme/Api  ', { host: 'github.com', owner: 'Acme', repo: 'Api' }],
  ])('reads %s', (url, expected) => {
    expect(parseGithubRepoUrl(url)).toEqual(expected);
  });

  it.each([
    ['https://github.acme.com/acme/api.git', { host: 'github.acme.com', owner: 'acme', repo: 'api' }],
    ['git@GitHub.Acme.com:acme/api.git', { host: 'github.acme.com', owner: 'acme', repo: 'api' }],
    ['ssh://git@github.acme.com:2222/acme/api', { host: 'github.acme.com', owner: 'acme', repo: 'api' }],
    ['https://acme.ghe.com/team/app', { host: 'acme.ghe.com', owner: 'team', repo: 'app' }],
  ])('reads %s on a known GitHub Enterprise', (url, expected) => {
    expect(parseGithubRepoUrl(url, ['github.acme.com', 'acme.ghe.com'])).toEqual(expected);
  });

  it('ignores GitHub Enterprise hosts no connection names', () => {
    expect(parseGithubRepoUrl('https://github.acme.com/acme/api')).toBeNull();
  });

  it.each([null, undefined, '', 'https://gitlab.com/acme/api', 'https://github.com/acme', 'not a url'])(
    'returns null for %p',
    (url) => {
      expect(parseGithubRepoUrl(url)).toBeNull();
    },
  );
});
