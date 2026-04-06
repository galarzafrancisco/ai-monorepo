import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { Scope } from 'src/auth/core/types/scope.type';
import { getConfig } from 'src/config/env.config';
import { CreateServerInput } from 'src/mcp-registry/dto';
import { ContextScopes } from 'src/context/context.scopes';

export function createContext(): CreateServerInput {
  const config = getConfig();

  return {
    providedId: 'context',
    name: 'Context',
    description: 'Context',
    type: 'http',
    url: `${config.issuerUrl}/api/v1/context/blocks/mcp`,
  };
}

export const createContextScopes: Scope[] = [
  McpScopes.USE,
  ContextScopes.READ,
  ContextScopes.WRITE,
];
