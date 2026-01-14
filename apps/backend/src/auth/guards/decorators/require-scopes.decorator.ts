import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPES_KEY = 'auth:required_scopes';

export type ScopeMode = 'all' | 'any';

export interface RequiredScopesMetadata {
  scopes: string[];
  mode: ScopeMode;
}

/**
 * Require OAuth scopes on a handler/class.
 *
 * @RequireScopes('task.read', 'task.write') // default mode=all
 * @RequireScopes({ mode: 'any', scopes: ['task.read', 'task.write'] })
 */
export function RequireScopes(...scopes: string[]): MethodDecorator & ClassDecorator;
export function RequireScopes(meta: RequiredScopesMetadata): MethodDecorator & ClassDecorator;
export function RequireScopes(
  ...args: [RequiredScopesMetadata] | string[]
): MethodDecorator & ClassDecorator {
  if (args.length === 1 && typeof args[0] === 'object') {
    const meta = args[0];
    return SetMetadata(REQUIRED_SCOPES_KEY, {
      scopes: meta.scopes ?? [],
      mode: meta.mode ?? 'all',
    } satisfies RequiredScopesMetadata);
  }

  return SetMetadata(REQUIRED_SCOPES_KEY, {
    scopes: args as string[],
    mode: 'all',
  } satisfies RequiredScopesMetadata);
}
