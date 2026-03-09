import { IsGitUrlConstraint } from './is-git-url.validator';

describe('IsGitUrlConstraint', () => {
  let validator: IsGitUrlConstraint;

  beforeEach(() => {
    validator = new IsGitUrlConstraint();
  });

  describe('HTTP/HTTPS URLs', () => {
    it('should accept HTTPS URLs', () => {
      expect(validator.validate('https://github.com/user/repo.git')).toBe(true);
      expect(validator.validate('https://gitlab.com/user/repo.git')).toBe(true);
    });

    it('should accept HTTP URLs', () => {
      expect(validator.validate('http://github.com/user/repo.git')).toBe(true);
    });

    it('should accept URLs without .git extension', () => {
      expect(validator.validate('https://github.com/user/repo')).toBe(true);
    });
  });

  describe('SSH URLs', () => {
    it('should accept standard SSH URLs', () => {
      expect(validator.validate('git@github.com:user/repo.git')).toBe(true);
      expect(validator.validate('git@gitlab.com:user/repo.git')).toBe(true);
    });

    it('should accept SSH URLs with subgroups', () => {
      expect(validator.validate('git@github.com:org/team/repo.git')).toBe(true);
    });

    it('should accept SSH URLs without .git extension', () => {
      expect(validator.validate('git@github.com:user/repo')).toBe(true);
    });

    it('should accept ssh:// protocol URLs', () => {
      expect(validator.validate('ssh://git@github.com/user/repo.git')).toBe(true);
    });

    it('should accept SSH URLs with custom ports', () => {
      expect(validator.validate('ssh://git@github.com:2222/user/repo.git')).toBe(true);
      expect(validator.validate('ssh://git@example.com:22/user/repo.git')).toBe(true);
    });
  });

  describe('Invalid URLs', () => {
    it('should reject non-string values', () => {
      expect(validator.validate(123)).toBe(false);
      expect(validator.validate(null)).toBe(false);
      expect(validator.validate(undefined)).toBe(false);
      expect(validator.validate({})).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(validator.validate('')).toBe(false);
    });

    it('should reject invalid formats', () => {
      expect(validator.validate('not-a-url')).toBe(false);
      expect(validator.validate('ftp://github.com/user/repo')).toBe(false);
    });

    it('should reject malformed SSH URLs', () => {
      expect(validator.validate('github.com:user/repo.git')).toBe(false);
      expect(validator.validate('@github.com:user/repo.git')).toBe(false);
    });

    it('should reject malformed HTTP/HTTPS URLs', () => {
      expect(validator.validate('https://')).toBe(false);
      expect(validator.validate('http://')).toBe(false);
      expect(validator.validate('https://invalid url with spaces')).toBe(false);
    });
  });

  describe('defaultMessage', () => {
    it('should return a helpful error message', () => {
      const message = validator.defaultMessage();
      expect(message).toContain('HTTP');
      expect(message).toContain('HTTPS');
      expect(message).toContain('SSH');
    });
  });
});
