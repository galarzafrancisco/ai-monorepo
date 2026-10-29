/**
 * Type-level regression tests for the generated contract types
 * (`contracts/types.ts`). They run during `build:prod` through
 * `npm run typecheck:contracts`; a failing assertion fails the build.
 *
 * openapi-typescript makes any property with a `default` required unless
 * `--default-non-nullable false` is passed. Request fields that the API
 * fills in when omitted must stay optional in the contract.
 */
import type { components } from '../contracts/types';

type Schemas = components['schemas'];
type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;
type Expect<T extends true> = T;

// Creating an MCP server without an auth type is allowed (defaults to taico).
export type CreateServerAuthTypeIsOptional = Expect<
  IsOptional<Schemas['CreateServerDto'], 'authType'>
>;
export const createServerWithoutAuthType: Schemas['CreateServerDto'] = {
  providedId: 'example',
  name: 'Example',
  description: 'Example server',
  type: 'http',
  url: 'http://localhost:3000/example/mcp',
};

// Responses always say which auth type the server uses.
export type ServerResponseAuthTypeIsRequired = Expect<
  IsOptional<Schemas['ServerResponseDto'], 'authType'> extends true
    ? false
    : true
>;

// Other request fields with server-side defaults.
export type CreateAgentDefaultsAreOptional = Expect<
  IsOptional<
    Schemas['CreateAgentDto'],
    'type' | 'statusTriggers' | 'tagTriggers' | 'allowedTools' | 'isActive'
  >
>;
