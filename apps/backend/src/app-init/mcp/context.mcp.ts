import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { Scope } from 'src/auth/core/types/scope.type';
import { baselineServerUrl } from 'src/mcp-registry/baseline-servers';
import { CreateServerInput } from 'src/mcp-registry/dto';
import { ContextScopes } from 'src/context/context.scopes';

export function createContext(): CreateServerInput {
  return {
    providedId: 'context',
    name: 'Context',
    description: 'Context',
    type: 'http',
    url: baselineServerUrl('context'),
  };
}

export const createContextScopes: Scope[] = [
  McpScopes.USE,
  ContextScopes.READ,
  ContextScopes.WRITE,
];
