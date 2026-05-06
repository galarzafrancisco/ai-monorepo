import { extractBearerToken, requireScopes } from './authorization-server.js';
import { InvalidTokenError } from './errors.js';
import type { AuthContext, Principal, ValidateTokenOptions } from './types.js';

const AUTH_SERVER = Symbol.for('@taico/authorization-server/auth-server');
const AUTH_SERVER_OPTIONS = Symbol.for('@taico/authorization-server/options');
const REQUIRED_SCOPES = Symbol.for('@taico/authorization-server/required-scopes');
const AUTHENTICATED = Symbol.for('@taico/authorization-server/authenticated');
const CURRENT_AUTH_PARAM = Symbol.for('@taico/authorization-server/current-auth-param');
const CURRENT_PRINCIPAL_PARAM = Symbol.for('@taico/authorization-server/current-principal-param');

type CoreAuth = {
  sessionCookieName?: string;
  validateToken(token: string, options?: ValidateTokenOptions): Promise<AuthContext>;
};

type ExecutionContextLike = {
  getHandler?(): unknown;
  getClass?(): unknown;
  switchToHttp?(): { getRequest(): NestRequestLike };
  switchToWs?(): { getClient(): NestWsClientLike };
};

type NestRequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  auth?: AuthContext;
};

type NestWsClientLike = {
  handshake?: {
    headers?: Record<string, string | string[] | undefined>;
    auth?: Record<string, unknown>;
  };
  auth?: AuthContext;
};

export function createNestAdapter(auth: CoreAuth) {
  return {
    auth,
    accessTokenGuard(options?: ValidateTokenOptions) {
      return new AccessTokenGuard(auth, options);
    },
    scopesGuard() {
      return new ScopesGuard();
    },
  };
}

export class AuthorizationServerModule {
  static forRoot(options: unknown) {
    return {
      module: AuthorizationServerModule,
      providers: [
        { provide: AUTH_SERVER_OPTIONS, useValue: options },
        { provide: AUTH_SERVER, useValue: options },
        AccessTokenGuard,
        ScopesGuard,
      ],
      exports: [AUTH_SERVER_OPTIONS, AUTH_SERVER, AccessTokenGuard, ScopesGuard],
    };
  }

  static forRootAsync(options: { useFactory?: (...args: unknown[]) => unknown; inject?: unknown[] } | unknown) {
    return {
      module: AuthorizationServerModule,
      providers: [
        { provide: AUTH_SERVER_OPTIONS, useValue: options },
        {
          provide: AUTH_SERVER,
          useFactory: typeof options === 'object' && options !== null && 'useFactory' in options ? options.useFactory : () => options,
          inject: typeof options === 'object' && options !== null && 'inject' in options ? options.inject : [],
        },
        AccessTokenGuard,
        ScopesGuard,
      ],
      exports: [AUTH_SERVER_OPTIONS, AUTH_SERVER, AccessTokenGuard, ScopesGuard],
    };
  }

  static registerMcpServer(options: unknown) {
    return {
      module: AuthorizationServerModule,
      providers: [{ provide: Symbol.for('@taico/authorization-server/mcp-server'), useValue: options }],
    };
  }
}

export function Authenticated(): ClassDecorator & MethodDecorator {
  return ((target: object, propertyKey?: string | symbol) => {
    setMetadata(target, propertyKey, AUTHENTICATED, true);
  }) as ClassDecorator & MethodDecorator;
}

export function AuthenticatedWs(): ClassDecorator & MethodDecorator {
  return Authenticated();
}

export function RequireScopes(...input: Array<string | { mode?: 'all' | 'any'; scopes: string[] }>): ClassDecorator & MethodDecorator {
  const value = typeof input[0] === 'object' ? input[0] : { mode: 'all' as const, scopes: input as string[] };
  return ((target: object, propertyKey?: string | symbol) => {
    setMetadata(target, propertyKey, REQUIRED_SCOPES, value);
  }) as ClassDecorator & MethodDecorator;
}

export class AccessTokenGuard {
  constructor(
    private readonly auth?: CoreAuth,
    private readonly options: ValidateTokenOptions = {},
  ) {}

  async canActivate(context: ExecutionContextLike): Promise<boolean> {
    if (!this.auth) {
      throw new InvalidTokenError('AccessTokenGuard requires an authorization server instance');
    }
    const target = getContextTarget(context);
    const token = extractBearerToken(target.headers) ?? target.cookies?.[this.auth.sessionCookieName ?? 'access_token'] ?? getWsToken(context);
    if (!token) {
      throw new InvalidTokenError('Missing bearer token');
    }
    target.auth = await this.auth.validateToken(token, this.options);
    return true;
  }
}

export class ScopesGuard {
  canActivate(context: ExecutionContextLike): boolean {
    const target = getContextTarget(context);
    if (!target.auth) {
      throw new InvalidTokenError('Missing authenticated request context');
    }
    const metadata = getScopeMetadata(context);
    if (!metadata) return true;
    requireScopes(target.auth.scopes, metadata.scopes, metadata.mode);
    return true;
  }
}

export function CurrentAuth(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    setParamMetadata(target, propertyKey, CURRENT_AUTH_PARAM, parameterIndex);
  };
}

export function CurrentPrincipal(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    setParamMetadata(target, propertyKey, CURRENT_PRINCIPAL_PARAM, parameterIndex);
  };
}

export function currentAuthFromRequest(req: NestRequestLike) {
  return req.auth;
}

export function currentPrincipalFromRequest(req: NestRequestLike) {
  return req.auth?.principal;
}

export type { AuthContext, Principal };

function getContextTarget(context: ExecutionContextLike): NestRequestLike {
  const http = context.switchToHttp?.().getRequest();
  if (http) return http;
  const ws = context.switchToWs?.().getClient();
  if (ws) return ws as NestRequestLike;
  return {};
}

function getWsToken(context: ExecutionContextLike) {
  const client = context.switchToWs?.().getClient();
  const authToken = client?.handshake?.auth?.token;
  if (typeof authToken === 'string') return authToken;
  return extractBearerToken(client?.handshake?.headers);
}

function getScopeMetadata(context: ExecutionContextLike): { mode: 'all' | 'any'; scopes: string[] } | undefined {
  return (
    getMetadata(REQUIRED_SCOPES, context.getHandler?.()) ??
    getMetadata(REQUIRED_SCOPES, context.getClass?.())
  ) as { mode: 'all' | 'any'; scopes: string[] } | undefined;
}

function setMetadata(target: object, propertyKey: string | symbol | undefined, key: symbol, value: unknown) {
  const receiver = propertyKey ? (target as Record<string | symbol, unknown>)[propertyKey] : target;
  const metadataReflect = Reflect as typeof Reflect & {
    defineMetadata?: (metadataKey: unknown, metadataValue: unknown, target: unknown) => void;
  };
  if (typeof metadataReflect.defineMetadata === 'function') {
    metadataReflect.defineMetadata(key, value, receiver);
    return;
  }
  if (typeof receiver === 'object' && receiver !== null) {
    metadataFallback.set(receiver, new Map([...(metadataFallback.get(receiver)?.entries() ?? []), [key, value]]));
  }
}

function getMetadata(key: symbol, target: unknown) {
  if (!target) return undefined;
  const metadataReflect = Reflect as typeof Reflect & { getMetadata?: (metadataKey: unknown, target: unknown) => unknown };
  if (typeof metadataReflect.getMetadata === 'function') return metadataReflect.getMetadata(key, target);
  return typeof target === 'object' && target !== null ? metadataFallback.get(target)?.get(key) : undefined;
}

function setParamMetadata(target: object, propertyKey: string | symbol | undefined, key: symbol, parameterIndex: number) {
  const receiver = propertyKey ? (target as Record<string | symbol, unknown>)[propertyKey] : target;
  const existing = (getMetadata(key, receiver) as number[] | undefined) ?? [];
  setMetadata(receiver as object, undefined, key, [...existing, parameterIndex]);
}

const metadataFallback = new WeakMap<object, Map<symbol, unknown>>();
