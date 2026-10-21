import {
  Catch,
  createParamDecorator,
  Global,
  Inject,
  Injectable,
  Module,
  Optional,
  SetMetadata,
  type ArgumentsHost,
  type CanActivate,
  type ExceptionFilter,
  type DynamicModule,
  type ExecutionContext,
  type InjectionToken,
  type MiddlewareConsumer,
  type ModuleMetadata,
  type NestModule,
  type OptionalFactoryDependency,
} from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { AuthError } from '../core/errors.js';
import {
  createNodeAuthHandler,
  errorResponse,
  type AuthHttpOptions,
} from '../core/http.js';
import { OAuthServer, type OAuthServerOptions } from '../core/oauth-server.js';
import {
  assertScopes,
  ResourceServer,
  type ResourceServerOptions,
} from '../core/resource-server.js';
import { toRequiredScopes, type RequiredScopes } from '../core/scopes.js';
import type { AuthContext } from '../core/types.js';

/** Injection token of the `ResourceServer` the guards verify against */
export const AUTH_RESOURCE_SERVER = Symbol.for('@taico/auth:resource-server');
/** Injection token of the `OAuthServer`, when the app is an authorization server */
export const AUTH_SERVER = Symbol.for('@taico/auth:server');
const AUTH_HTTP_OPTIONS = Symbol.for('@taico/auth:http-options');

export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRED_SCOPES_KEY = 'auth:required_scopes';

/** Marks a route or controller as needing no access token */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Requires scopes on a route or controller.
 *
 * @RequireScopes('notes:read', 'notes:write')           // all of them
 * @RequireScopes({ mode: 'any', scopes: ['a', 'b'] })   // at least one
 */
export function RequireScopes(
  ...scopes: string[] | [Partial<RequiredScopes>]
): MethodDecorator & ClassDecorator {
  return SetMetadata(REQUIRED_SCOPES_KEY, toRequiredScopes(scopes));
}

type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  originalUrl?: string;
  url?: string;
  protocol?: string;
  auth?: AuthContext;
  // Fastify keeps the Node request here
  raw?: { auth?: AuthContext };
};
type HttpResponse = { locals?: Record<string, unknown> };

/** Public URL of a request, as the resource server checks it */
function requestUrlOf(auth: ResourceServer, request: HttpRequest): string {
  const origin = `${request.protocol ?? 'http'}://${String(request.headers.host ?? 'localhost')}`;
  return auth.requestUrl(request.originalUrl ?? request.url ?? '/', origin);
}

/** The `AuthContext` of a request `AccessTokenGuard` accepted */
export function authContextOf(context: ExecutionContext): AuthContext | undefined {
  const http = context.switchToHttp();
  const request = http.getRequest<HttpRequest>();
  return (
    request.auth ??
    (http.getResponse<HttpResponse>().locals?.auth as AuthContext | undefined)
  );
}

/** Injects the request's `AuthContext` into a handler parameter */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => authContextOf(context),
);

/**
 * Authenticates a request with its access token and attaches the
 * `AuthContext` (to `req.auth`, and to `res.locals.auth` on Express).
 * Throws `AuthError`s; map them to responses in an exception filter, or use
 * `AuthExceptionFilter`.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(AUTH_RESOURCE_SERVER) private readonly auth: ResourceServer,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();
    const authContext = await this.auth.authenticate(
      {
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
      },
      requestUrlOf(this.auth, request),
    );
    request.auth = authContext;
    if (response.locals) {
      response.locals.auth = authContext;
    }
    return true;
  }
}

/** Enforces `@RequireScopes`. Run it after `AccessTokenGuard`. */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    const required = this.reflector.getAllAndOverride<RequiredScopes | undefined>(
      REQUIRED_SCOPES_KEY,
      targets,
    );
    if (required) {
      assertScopes(authContextOf(context), required);
    }
    return true;
  }
}

/**
 * Answers the guards' errors with the right status and Bearer challenge.
 * Optional: a host with its own error format maps `AuthError`s itself.
 *
 * { provide: APP_FILTER, useClass: AuthExceptionFilter }
 */
@Catch(AuthError)
@Injectable()
export class AuthExceptionFilter implements ExceptionFilter<AuthError> {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Optional()
    @Inject(AUTH_RESOURCE_SERVER)
    private readonly auth?: ResourceServer | null,
  ) {}

  catch(error: AuthError, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const http = host.switchToHttp();
    const response = http.getResponse<unknown>();
    // Points the client at the metadata of the resource, so it can find the
    // authorization server from a 401 on any route (RFC 9728 section 5.1)
    const resourceMetadataUrl =
      this.auth && host.getType() === 'http'
        ? this.auth.resourceMetadataUrl(requestUrlOf(this.auth, http.getRequest<HttpRequest>()))
        : undefined;
    const result = errorResponse(error, { resourceMetadataUrl });
    for (const [name, value] of Object.entries(result.headers)) {
      httpAdapter.setHeader(response, name, value);
    }
    httpAdapter.reply(response, result.body, result.status);
  }
}

export type AuthModuleOptions = {
  /** The authorization server. Omit for an app that only verifies tokens. */
  server?: OAuthServer | OAuthServerOptions;
  /**
   * How requests are verified. Defaults to trusting `server`'s own tokens;
   * required when there is no `server`.
   */
  resourceServer?: ResourceServer | ResourceServerOptions;
  /**
   * With the default resource server: the URL of the protected resource the
   * app's routes make up, so a 401 on any route points at its metadata.
   */
  resource?: string | string[];
  /** Options of the authorization server's HTTP endpoints */
  http?: AuthHttpOptions;
};

export type AuthModuleAsyncOptions = Pick<ModuleMetadata, 'imports'> & {
  useFactory: (...args: any[]) => AuthModuleOptions | Promise<AuthModuleOptions>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
};

const AUTH_MODULE_OPTIONS = Symbol.for('@taico/auth:module-options');

function serverOf(options: AuthModuleOptions): OAuthServer | null {
  if (!options.server) return null;
  return options.server instanceof OAuthServer
    ? options.server
    : new OAuthServer(options.server);
}

function resourceServerOf(
  options: AuthModuleOptions,
  server: OAuthServer | null,
): ResourceServer {
  if (options.resourceServer) {
    return options.resourceServer instanceof ResourceServer
      ? options.resourceServer
      : new ResourceServer(options.resourceServer);
  }
  if (!server) {
    throw new Error('AuthModule needs a server or a resourceServer');
  }
  return server.resourceServer({ resource: options.resource });
}

/**
 * Wires the package into a Nest app. Global, so the guards can be used in
 * any module without importing anything.
 *
 * AuthModule.forResourceServer({ issuer, jwks: remoteJwks(url), audience })
 * AuthModule.forRoot({ server: { config, stores, resources, identity } })
 * AuthModule.forRootAsync({ inject: [DataSource], useFactory: (ds) => ({ ... }) })
 *
 * With a `server`, its HTTP endpoints are mounted as middleware under the
 * server's `basePath` and `/.well-known`, outside any global prefix.
 */
@Global()
@Module({})
export class AuthModule implements NestModule {
  constructor(
    @Optional() @Inject(AUTH_SERVER) private readonly server: OAuthServer | null,
    @Optional() @Inject(AUTH_HTTP_OPTIONS) private readonly http?: AuthHttpOptions,
  ) {}

  static forResourceServer(
    resourceServer: ResourceServer | ResourceServerOptions,
  ): DynamicModule {
    return AuthModule.forRoot({ resourceServer });
  }

  static forRoot(options: AuthModuleOptions): DynamicModule {
    return AuthModule.forRootAsync({ useFactory: () => options });
  }

  static forRootAsync(options: AuthModuleAsyncOptions): DynamicModule {
    return {
      module: AuthModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: AUTH_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        {
          provide: AUTH_SERVER,
          useFactory: (resolved: AuthModuleOptions) => serverOf(resolved),
          inject: [AUTH_MODULE_OPTIONS],
        },
        {
          provide: AUTH_RESOURCE_SERVER,
          useFactory: (resolved: AuthModuleOptions, server: OAuthServer | null) =>
            resourceServerOf(resolved, server),
          inject: [AUTH_MODULE_OPTIONS, AUTH_SERVER],
        },
        {
          provide: AUTH_HTTP_OPTIONS,
          useFactory: (resolved: AuthModuleOptions) => resolved.http ?? {},
          inject: [AUTH_MODULE_OPTIONS],
        },
        AccessTokenGuard,
        ScopesGuard,
      ],
      exports: [AUTH_SERVER, AUTH_RESOURCE_SERVER, AccessTokenGuard, ScopesGuard],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    if (this.server) {
      consumer.apply(createNodeAuthHandler(this.server, this.http)).forRoutes('*');
    }
  }
}

export { OAuthServer, ResourceServer };
export type { AuthContext, RequiredScopes };
