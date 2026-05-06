import type { AuthContext, Principal } from './types.js';

const AUTH_SERVER_OPTIONS = Symbol.for('@taico/authorization-server/options');
const REQUIRED_SCOPES = Symbol.for('@taico/authorization-server/required-scopes');
const AUTHENTICATED = Symbol.for('@taico/authorization-server/authenticated');

export function createNestAdapter(auth: unknown) {
  return { auth };
}

export class AuthorizationServerModule {
  static forRoot(options: unknown) {
    return {
      module: AuthorizationServerModule,
      providers: [{ provide: AUTH_SERVER_OPTIONS, useValue: options }],
      exports: [AUTH_SERVER_OPTIONS],
    };
  }

  static forRootAsync(options: unknown) {
    return {
      module: AuthorizationServerModule,
      providers: [{ provide: AUTH_SERVER_OPTIONS, useValue: options }],
      exports: [AUTH_SERVER_OPTIONS],
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

export function RequireScopes(...scopes: string[]): ClassDecorator & MethodDecorator {
  return ((target: object, propertyKey?: string | symbol) => {
    setMetadata(target, propertyKey, REQUIRED_SCOPES, scopes);
  }) as ClassDecorator & MethodDecorator;
}

export class AccessTokenGuard {}
export class ScopesGuard {}

export function CurrentAuth(): ParameterDecorator {
  return () => undefined;
}

export function CurrentPrincipal(): ParameterDecorator {
  return () => undefined;
}

export type { AuthContext, Principal };

function setMetadata(target: object, propertyKey: string | symbol | undefined, key: symbol, value: unknown) {
  const receiver = propertyKey ? (target as Record<string | symbol, unknown>)[propertyKey] : target;
  const metadataReflect = Reflect as typeof Reflect & {
    defineMetadata?: (metadataKey: unknown, metadataValue: unknown, target: unknown) => void;
  };
  if (typeof metadataReflect.defineMetadata === 'function') {
    metadataReflect.defineMetadata(key, value, receiver);
  }
}
