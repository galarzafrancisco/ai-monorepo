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
  createNodeProtectedResourceMetadata,
  errorResponse,
  type AuthHttpOptions,
} from '../core/http.js';
import { OAuthServer, type OAuthServerOptions } from '../core/oauth-server.js';
import type { ProtectedResource, ResourceRegistry } from '../core/ports.js';
import {
  assertScopes,
  ResourceServer,
  type ProtectedResourceMetadataOptions,
  type ResourceServerOptions,
} from '../core/resource-server.js';
import { toRequiredScopes, type RequiredScopes } from '../core/scopes.js';
import type { AuthContext } from '../core/types.js';

/** Injection token of the `ResourceServer` the guards verify against */
export const AUTH_RESOURCE_SERVER = Symbol.for('@taico/auth:resource-server');
/** Injection token of the `OAuthServer`, when the app is an authorization server */
export const AUTH_SERVER = Symbol.for('@taico/auth:server');
/**
 * Injection token of the named resource servers, a
 * `Record<string, ResourceServer>`, picked with `@UseResourceServer(name)`
 */
export const AUTH_RESOURCE_SERVERS = Symbol.for('@taico/auth:resource-servers');
const AUTH_HTTP_OPTIONS = Symbol.for('@taico/auth:http-options');
const AUTH_METADATA = Symbol.for('@taico/auth:metadata');
export const RESOURCE_SERVER_KEY = 'auth:resource_server';

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

/**
 * Verifies a route or controller against one of the named resource servers
 * of `AuthModule` (`resourceServers`) instead of the default one. For an app
 * that serves several protected resources, each with its own audience.
 *
 * @UseResourceServer('files')
 */
export const UseResourceServer = (name: string) => SetMetadata(RESOURCE_SERVER_KEY, name);

/** The resource server each request was checked against, for the exception filter */
const usedResourceServers = new WeakMap<object, ResourceServer>();

/** Picks the default or a named resource server */
export function pickResourceServer(
  name: string | undefined,
  fallback: ResourceServer | null | undefined,
  named: Record<string, ResourceServer> | null | undefined,
): ResourceServer {
  if (name !== undefined) {
    const found = named?.[name];
    if (!found) {
      throw new Error(`No resource server named "${name}" in AuthModule resourceServers`);
    }
    return found;
  }
  if (!fallback) {
    throw new Error(
      'No default resource server: configure resourceServer, or name one with @UseResourceServer',
    );
  }
  return fallback;
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
    @Optional() @Inject(AUTH_RESOURCE_SERVER) private readonly auth: ResourceServer | null,
    private readonly reflector: Reflector,
    @Optional()
    @Inject(AUTH_RESOURCE_SERVERS)
    private readonly named?: Record<string, ResourceServer> | null,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    const auth = pickResourceServer(
      this.reflector.getAllAndOverride<string | undefined>(RESOURCE_SERVER_KEY, targets),
      this.auth,
      this.named,
    );

    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();
    usedResourceServers.set(request, auth);
    const authContext = await auth.authenticate(
      {
        authorization: request.headers.authorization,
        cookie: request.headers.cookie,
      },
      requestUrlOf(auth, request),
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
    let resourceMetadataUrl: string | undefined;
    if (host.getType() === 'http') {
      const request = http.getRequest<HttpRequest>();
      const auth = usedResourceServers.get(request) ?? this.auth;
      resourceMetadataUrl = auth?.resourceMetadataUrl(requestUrlOf(auth, request));
    }
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
  /**
   * More resource servers, by name, for routes marked
   * `@UseResourceServer(name)`: an app that serves several resources with
   * different audiences or issuers. Alternatively, one resource server with a
   * `resourceAudience(a, b)` policy binds each token to its own URL.
   */
  resourceServers?: Record<string, ResourceServer | ResourceServerOptions>;
  /**
   * Serves RFC 9728 protected resource metadata for these resources, for an
   * app whose authorization server is elsewhere. Mounted as middleware at
   * `/.well-known/oauth-protected-resource`, outside any global prefix.
   */
  metadata?: ProtectedResourceMetadataOptions & {
    resources: ResourceRegistry | readonly ProtectedResource[];
  };
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

const toResourceServer = (value: ResourceServer | ResourceServerOptions) =>
  value instanceof ResourceServer ? value : new ResourceServer(value);

function resourceServerOf(
  options: AuthModuleOptions,
  server: OAuthServer | null,
): ResourceServer | null {
  if (options.resourceServer) {
    return toResourceServer(options.resourceServer);
  }
  if (server) {
    return server.resourceServer({ resource: options.resource });
  }
  if (options.resourceServers && Object.keys(options.resourceServers).length > 0) {
    // Every protected route names its resource server
    return null;
  }
  throw new Error('AuthModule needs a server, a resourceServer or resourceServers');
}

function namedResourceServersOf(options: AuthModuleOptions): Record<string, ResourceServer> {
  return Object.fromEntries(
    Object.entries(options.resourceServers ?? {}).map(([name, value]) => [
      name,
      toResourceServer(value),
    ]),
  );
}

/**
 * Wires the package into a Nest app. Global, so the guards can be used in
 * any module without importing anything.
 *
 * AuthModule.forResourceServer({ issuer, jwks: remoteJwks(url), audience })
 * AuthModule.forRoot({ resourceServers: { notes, files }, metadata: { resources, authorizationServers } })
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
    @Optional()
    @Inject(AUTH_METADATA)
    private readonly metadata?: AuthModuleOptions['metadata'] | null,
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
          provide: AUTH_RESOURCE_SERVERS,
          useFactory: (resolved: AuthModuleOptions) => namedResourceServersOf(resolved),
          inject: [AUTH_MODULE_OPTIONS],
        },
        {
          provide: AUTH_METADATA,
          useFactory: (resolved: AuthModuleOptions) => resolved.metadata ?? null,
          inject: [AUTH_MODULE_OPTIONS],
        },
        {
          provide: AUTH_HTTP_OPTIONS,
          useFactory: (resolved: AuthModuleOptions) => resolved.http ?? {},
          inject: [AUTH_MODULE_OPTIONS],
        },
        AccessTokenGuard,
        ScopesGuard,
      ],
      exports: [
        AUTH_SERVER,
        AUTH_RESOURCE_SERVER,
        AUTH_RESOURCE_SERVERS,
        AccessTokenGuard,
        ScopesGuard,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    if (this.metadata) {
      const { resources, ...options } = this.metadata;
      consumer.apply(createNodeProtectedResourceMetadata(resources, options)).forRoutes('*');
    }
    if (this.server) {
      consumer.apply(createNodeAuthHandler(this.server, this.http)).forRoutes('*');
    }
  }
}

export { OAuthServer, ResourceServer };
export type { AuthContext, RequiredScopes };
