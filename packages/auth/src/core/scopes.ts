import type { Scope } from './types.js';

export type ScopeMode = 'all' | 'any';

export type RequiredScopes = {
  scopes: string[];
  mode: ScopeMode;
};

/**
 * Reads a `scope` value into a list. Accepts the RFC 9068 space-delimited
 * string and the array form older tokens carry.
 */
export function parseScope(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\s+/)
      : [];
  return [
    ...new Set(
      items.filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      ),
    ),
  ];
}

/** Writes scopes in the RFC 9068 form: one space-delimited string */
export function formatScope(scopes: readonly string[]): string {
  return parseScope([...scopes]).join(' ');
}

export function hasScopes(
  granted: readonly string[],
  required: readonly string[],
  mode: ScopeMode = 'all',
): boolean {
  if (required.length === 0) {
    return true;
  }
  const grantedSet = new Set(granted);
  return mode === 'any'
    ? required.some((scope) => grantedSet.has(scope))
    : required.every((scope) => grantedSet.has(scope));
}

/** Normalizes the two ways of declaring required scopes */
export function toRequiredScopes(
  args: readonly (string | Partial<RequiredScopes>)[],
): RequiredScopes {
  const [first] = args;
  if (args.length === 1 && typeof first === 'object') {
    return { scopes: first.scopes ?? [], mode: first.mode ?? 'all' };
  }
  return { scopes: args as string[], mode: 'all' };
}

/**
 * The scopes a host knows about. Features register their own scopes, so the
 * auth code does not have to import every feature.
 */
export class ScopeRegistry {
  private readonly scopes = new Map<string, Scope>();

  constructor(scopes: readonly Scope[] = []) {
    this.register(...scopes);
  }

  register(...scopes: readonly Scope[]): this {
    for (const scope of scopes) {
      this.scopes.set(scope.id, scope);
    }
    return this;
  }

  all(): Scope[] {
    return [...this.scopes.values()];
  }

  ids(): string[] {
    return [...this.scopes.keys()];
  }

  get(id: string): Scope | undefined {
    return this.scopes.get(id);
  }

  has(id: string): boolean {
    return this.scopes.has(id);
  }
}
