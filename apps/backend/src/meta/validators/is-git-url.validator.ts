import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import isURL from 'validator/lib/isURL';

/**
 * Custom validator for Git repository URLs.
 * Accepts both HTTP/HTTPS URLs and SSH Git URLs.
 *
 * Valid formats:
 * - HTTPS: https://github.com/user/repo.git
 * - HTTP: http://github.com/user/repo.git
 * - SSH: git@github.com:user/repo.git
 * - SSH alternative: ssh://git@github.com:port/user/repo.git (with optional port)
 */
@ValidatorConstraint({ name: 'isGitUrl', async: false })
export class IsGitUrlConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    // Use validator library for strict HTTP/HTTPS validation
    const isHttpUrl = isURL(value, {
      protocols: ['http', 'https'],
      require_protocol: true,
    });

    // SSH URL patterns:
    // - git@host:path/to/repo.git
    // - ssh://git@host/path/to/repo.git
    // - ssh://git@host:port/path/to/repo.git (with custom port)
    const sshPattern =
      /^(git@[\w.-]+:[\w./-]+|ssh:\/\/git@[\w.-]+(:\d+)?\/[\w./-]+)$/;

    return isHttpUrl || sshPattern.test(value);
  }

  defaultMessage(): string {
    return 'Repository URL must be a valid HTTP, HTTPS, or SSH Git URL';
  }
}

/**
 * Decorator to validate Git repository URLs.
 * Use this instead of @IsUrl() for repository URL fields.
 *
 * @example
 * ```typescript
 * @IsGitUrl()
 * @IsOptional()
 * repoUrl?: string;
 * ```
 */
export function IsGitUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsGitUrlConstraint,
    });
  };
}
