import { AiProvidersScopes } from 'src/ai-providers/ai-providers.scopes';
import { AgentRunsScopes } from 'src/agent-runs/agent-runs.scopes';
import { ALL_API_SCOPES } from 'src/auth/core/scopes/all-api.scopes';
import { InstallationScopes } from 'src/auth/core/scopes/installation.scopes';
import { UserScopes } from 'src/auth/core/scopes/user.scopes';
import { Scope } from 'src/auth/core/types/scope.type';
import { WorkersScopes } from 'src/executions/workers.scopes';
import { IntegrationsScopes } from 'src/integrations/integrations.scopes';
import { McpRegistryScopes } from 'src/mcp-registry/mcp-registry.scopes';
import { SearchScopes } from 'src/search/search.scopes';
import { SecretsScopes } from 'src/secrets/secrets.scopes';

/**
 * Scopes only a workspace admin holds: `user:admin` itself, and writing the
 * workspace's shared settings (MCP registry, GitHub and other integrations,
 * secrets, AI providers). A member never gets them, in any token.
 */
export const WORKSPACE_ADMIN_SCOPES: readonly Scope[] = [
  UserScopes.ADMIN,
  McpRegistryScopes.WRITE,
  IntegrationsScopes.WRITE,
  IntegrationsScopes.DELETE,
  SecretsScopes.WRITE,
  SecretsScopes.DELETE,
  AiProvidersScopes.WRITE,
  AiProvidersScopes.DELETE,
  AiProvidersScopes.CONFIGURE,
];

/**
 * Held only by installation operators, and only in their web sessions:
 * `installation:admin` and configuring installation-wide search.
 */
export const INSTALLATION_SCOPES: readonly Scope[] = [
  InstallationScopes.ADMIN,
  SearchScopes.CONFIGURE,
];

/**
 * Scopes that belong to one kind of client, never to a person's session or
 * a token they hand out: `workers:connect` (workers, through the worker auth
 * target) and `run:impersonate` (getting agent tokens).
 */
export const CLIENT_ONLY_SCOPES: readonly Scope[] = [
  WorkersScopes.CONNECT,
  AgentRunsScopes.IMPERSONATE,
];

const ids = (scopes: readonly Scope[]) => scopes.map((s) => s.id);

export const WORKSPACE_ADMIN_SCOPE_IDS: readonly string[] = ids(WORKSPACE_ADMIN_SCOPES);
export const INSTALLATION_SCOPE_IDS: readonly string[] = ids(INSTALLATION_SCOPES);
export const CLIENT_ONLY_SCOPE_IDS: readonly string[] = ids(CLIENT_ONLY_SCOPES);

/** Every scope Taico itself defines. Anything else is an MCP registry server's own scope. */
export const TAICO_SCOPE_IDS: ReadonlySet<string> = new Set([
  ...ids(ALL_API_SCOPES),
  UserScopes.ADMIN.id,
  UserScopes.STANDARD.id,
  ...INSTALLATION_SCOPE_IDS,
  ...CLIENT_ONLY_SCOPE_IDS,
]);

/**
 * What every member holds in their workspace: every API scope except the
 * workspace-admin, installation and client-only ones, plus `user:standard`.
 */
export const MEMBER_SCOPE_IDS: readonly string[] = [
  ...ids(ALL_API_SCOPES).filter(
    (id) =>
      !WORKSPACE_ADMIN_SCOPE_IDS.includes(id) &&
      !INSTALLATION_SCOPE_IDS.includes(id) &&
      !CLIENT_ONLY_SCOPE_IDS.includes(id),
  ),
  UserScopes.STANDARD.id,
];

/**
 * What a workspace admin holds: a member's scopes plus the admin ones, with
 * `user:admin` in place of `user:standard`.
 */
export const ADMIN_SCOPE_IDS: readonly string[] = [
  ...MEMBER_SCOPE_IDS.filter((id) => id !== UserScopes.STANDARD.id),
  ...WORKSPACE_ADMIN_SCOPE_IDS,
];
