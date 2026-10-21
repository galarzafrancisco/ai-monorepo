# The auth package (`@taico/auth`)

`packages/auth` holds the reusable part of Taico's authentication and authorization: verifying tokens, managing signing keys, guards and middleware, and a complete OAuth 2.1 authorization server. It exists so another app can accept Taico's tokens, or run its own issuer, without copying backend code.

The package's own [README](../../packages/auth/README.md) is the reference for its API. This guide covers how the Taico backend uses it and where the boundary is.

## What the backend takes from the package

| Concern | Backend file | Package piece |
|---|---|---|
| Signing keys, rotation, key cache | `auth/crypto/jwks.service.ts`, `jwks-key.store.ts` | `KeyManager` behind a `KeyStore` |
| Signing | `auth/crypto/token-signer.service.ts` | `TokenSigner` |
| Verification, revocation | `auth/crypto/token-verifier.service.ts`, `issued-token-revocation.service.ts` | `TokenVerifier` with a `RevocationChecker` |
| Audience rules | `auth/core/resource-audience.ts` | `AudiencePolicy` combinators |
| HTTP and websocket guards, `@RequireScopes`, `@Public` | `auth/guards/` (re-exports) | `@taico/auth/nest`, `@taico/auth/nest-ws` |
| `WWW-Authenticate` challenge | `http/problem-details.filter.ts` | `buildChallenge` |
| Scope claim format | everywhere a token is minted or read | `formatScope`, `parseScope` |

`AuthGuardsModule` is global and provides the one `ResourceServer` the guards use. A feature module only puts the guards on its controllers:

```ts
@Controller('things')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class ThingsController {
  @Get()
  @RequireScopes(ThingsScopes.READ.id)
  list(@CurrentUser() user: UserContext) { /* ... */ }
}
```

## Rules that follow from this

- **Sign tokens only through `TokenSignerService`.** It is the single signing path; do not import `jose` to sign.
- **Read scopes with `parseScope`**, or from `AuthContext.scopes`. The `scope` claim is a space-delimited string (RFC 9068); tokens minted before that change carry an array, and `parseScope` reads both.
- **Verification includes revocation.** Anything that goes through `TokenVerifierService` (guards, sockets, introspection, token exchange, the session cookie) refuses a token whose `jti` is revoked in `issued_access_tokens`. This costs one indexed lookup per verification.
- **Auth failures are `AuthError`s.** Throw the package's `MissingAccessTokenError`, `InvalidAccessTokenError` or `InsufficientScopeError`; the global filter adds the challenge header.

## What still lives in the backend

Taico's own authorization endpoints (`authorization-server/`, `auth-journeys/`, `discovery/`) and its user model (`identity-provider/`) are not yet built on the package's `OAuthServer`. They predate it and differ in shape: one authorization server per MCP server at path-shaped URLs, journeys that span several downstream OAuth providers, and foreign keys from flow tables into MCP and actor tables.

The package's engine covers the same protocol surface (authorization code + PKCE, refresh rotation, dynamic registration, client ID metadata documents, `private_key_jwt`, introspection, revocation) and has the `afterConsent` hook for the downstream brokering. Moving Taico onto it is a separate piece of work because it needs a data migration from `authorization_journeys` / `mcp_authorization_flows` into the package's grant table, and a decision about the per-server issuer URLs that existing MCP clients have cached.

## Using the package from a new app

To accept Taico's tokens in another service:

```ts
import { createResourceServer, exactResource, remoteJwks } from '@taico/auth';

const auth = createResourceServer({
  issuer: process.env.TAICO_URL,
  jwks: remoteJwks(`${process.env.TAICO_URL}/.well-known/jwks.json`),
  audience: exactResource('https://newapp.example.com/mcp'),
  baseUrl: 'https://newapp.example.com',
});
```

Then use `@taico/auth/nest`, `/express` or `/hono` as shown in the package README. Register the app's URL as an MCP server in Taico so tokens are minted with that audience.

A 401 on any route of the app points at the metadata of `https://newapp.example.com/mcp`, which `protectedResourceMetadata` serves. If the app is an MCP server built on `@modelcontextprotocol/sdk`, put `requireAuth` in front of the transport: the `AuthContext` on `req.auth` is the SDK's `AuthInfo`. A CLI for the app only needs its URL: `new TokenManager({ resource: 'https://newapp.example.com/mcp', ... })` from `@taico/auth/client` finds Taico from the 401.

Things a third-party app should know about Taico's tokens:

- **Claims.** Read them typed with `authenticate<TaicoClaims>(...)`: `actor_id`, `actor_slug`, `actor_type`, `email`, `displayName`. Scopes record what the user approved for the client, not what the user is allowed to do. Any user who logs in is granted the requested scopes that the server defines. Per-user permissions are the app's job.
- **Authorization servers.** Taico has one authorization server per MCP server. When an app serves the metadata itself, pass `authorizationServers` as a function of the resource.
- **Several resources in one app.** Use `resourceAudience(a, b)`, or in Nest, named resource servers with `@UseResourceServer`. Then a token for one resource is refused on the other.

The revocable, long-lived agent tokens are first-party tokens (their audience is Taico itself), so an app that accepts only its own resource URL never sees them. What it receives are the short-lived tokens of the OAuth flow, which are not individually revocable; keep their lifetime short.

## Tests

```bash
npm -w packages/auth test
```

The suite builds the package and runs it as a consumer would: the full authorization code flow in memory and on SQLite through TypeORM, an Express authorization server with a separate resource server driven by the package's own client, the same checks on Hono, a real Nest application with the module, guards and filter, and a second Nest application that serves two resources with named resource servers. It also drives the built-in login and consent pages the way a browser would, with HTML form posts.
