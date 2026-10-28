import { parseGithubRepoUrl } from './github-repo-ref';

describe('parseGithubRepoUrl', () => {
  it.each([
    ['https://github.com/acme/api', { owner: 'acme', repo: 'api' }],
    ['https://github.com/acme/api.git', { owner: 'acme', repo: 'api' }],
    ['https://github.com/acme/api/pull/12', { owner: 'acme', repo: 'api' }],
    ['git@github.com:acme/api.git', { owner: 'acme', repo: 'api' }],
    ['ssh://git@github.com/acme/api.git', { owner: 'acme', repo: 'api' }],
    ['  https://GitHub.com/Acme/Api  ', { owner: 'Acme', repo: 'Api' }],
  ])('reads %s', (url, expected) => {
    expect(parseGithubRepoUrl(url)).toEqual(expected);
  });

  it.each([null, undefined, '', 'https://gitlab.com/acme/api', 'https://github.com/acme', 'not a url'])(
    'returns null for %p',
    (url) => {
      expect(parseGithubRepoUrl(url)).toBeNull();
    },
  );
});
