import { githubApiUrlFor, githubHostOf, normalizeGithubUrl } from './github-host';

describe('normalizeGithubUrl', () => {
  it.each([
    [undefined, 'https://github.com'],
    ['', 'https://github.com'],
    ['https://github.com/', 'https://github.com'],
    ['www.github.com', 'https://github.com'],
    ['https://api.github.com', 'https://github.com'],
    ['github.acme.com', 'https://github.acme.com'],
    [' https://GitHub.Acme.com/some/path ', 'https://github.acme.com'],
    ['https://acme.ghe.com', 'https://acme.ghe.com'],
    ['http://10.0.0.5:8080', 'http://10.0.0.5:8080'],
  ])('reads %p', (input, expected) => {
    expect(normalizeGithubUrl(input)).toBe(expected);
  });

  it.each(['ftp://github.acme.com', 'https://user:pass@github.acme.com', 'https://'])('refuses %p', (input) => {
    expect(normalizeGithubUrl(input)).toBeNull();
  });
});

describe('githubApiUrlFor', () => {
  const saved = process.env.GITHUB_API_URL;
  beforeEach(() => delete process.env.GITHUB_API_URL);
  afterAll(() => {
    if (saved === undefined) delete process.env.GITHUB_API_URL;
    else process.env.GITHUB_API_URL = saved;
  });

  it('knows github.com, GitHub Enterprise Cloud with data residency, and GitHub Enterprise Server', () => {
    expect(githubApiUrlFor('https://github.com')).toBe('https://api.github.com');
    expect(githubApiUrlFor('https://acme.ghe.com')).toBe('https://api.acme.ghe.com');
    expect(githubApiUrlFor('https://github.acme.com')).toBe('https://github.acme.com/api/v3');
    expect(githubApiUrlFor('http://10.0.0.5:8080')).toBe('http://10.0.0.5:8080/api/v3');
  });

  it('lets GITHUB_API_URL stand in for api.github.com only', () => {
    process.env.GITHUB_API_URL = 'http://127.0.0.1:9999/';
    expect(githubApiUrlFor('https://github.com')).toBe('http://127.0.0.1:9999');
    expect(githubApiUrlFor('https://github.acme.com')).toBe('https://github.acme.com/api/v3');
  });
});

describe('githubHostOf', () => {
  it('is the lower-case host with its port', () => {
    expect(githubHostOf('https://GitHub.Acme.com')).toBe('github.acme.com');
    expect(githubHostOf('http://10.0.0.5:8080')).toBe('10.0.0.5:8080');
  });
});
