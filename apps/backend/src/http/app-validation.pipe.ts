import {
  ArgumentMetadata,
  Injectable,
  SetMetadata,
  ValidationPipe,
} from '@nestjs/common';

const IGNORES_UNKNOWN_PROPERTIES_KEY = 'validation:ignores_unknown_properties';

/**
 * Marks a request DTO whose unknown properties are dropped instead of rejected.
 *
 * For requests sent by third-party OAuth clients: RFC 6749 section 3.1 and
 * RFC 7591 section 2 require the authorization server to ignore parameters and
 * client metadata it does not understand, and clients add new ones over time
 * (for example `application_type`).
 */
export const IgnoresUnknownProperties = (): ClassDecorator =>
  SetMetadata(IGNORES_UNKNOWN_PROPERTIES_KEY, true);

/**
 * The application's global validation pipe. Unknown properties are rejected,
 * except on DTOs marked with @IgnoresUnknownProperties(), where they are
 * stripped. Known properties are validated the same way in both cases.
 */
@Injectable()
export class AppValidationPipe extends ValidationPipe {
  private readonly lenient = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
  });

  constructor() {
    super({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  }

  transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const ignoresUnknown =
      typeof metadata.metatype === 'function' &&
      Reflect.getMetadata(IGNORES_UNKNOWN_PROPERTIES_KEY, metadata.metatype);
    return ignoresUnknown
      ? this.lenient.transform(value, metadata)
      : super.transform(value, metadata);
  }
}
