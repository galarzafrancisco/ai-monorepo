# @taico/authorization-server

Standalone authorization server primitives for Taico-style REST, web, and MCP applications.

The package exposes a transport-neutral core, an Express adapter, MCP resource registration, JWT/JWKS handling, hosted login and consent flows, and a SQLite storage adapter.

Mount the Express adapter at the app root. The adapter owns its configured `basePath` (default `/auth`) so it can expose RFC 8414 pathful issuer discovery at `/.well-known/oauth-authorization-server/auth` while serving OAuth endpoints under `/auth`.

Use `auth.discovery.wellKnownUrl()` when printing or linking issuer metadata. Pathful issuers are easy to reconstruct incorrectly by hand.

Browser clients need CORS enabled explicitly:

```typescript
const auth = await createAuthorizationServer({
  issuer: 'http://localhost:3100',
  storage,
  identityProvider,
  cors: { origins: ['http://localhost:5173'], credentials: true },
});
```

The OAuth password grant is disabled by default. Hosted login screens can still authenticate with the configured identity provider, but `/token` only advertises and accepts `grant_type=password` when `grants: { password: true }` is configured. MCP resource tokens must include the MCP resource URL as `audience` or `resource` in the token request.

`createPublicClient` creates an OAuth public client, meaning no `client_secret` is issued or expected. Use it for browser, CLI, and MCP clients that use PKCE.

Screen modes are currently:

- `default`: package-rendered HTML for quick starts and demos.
- `hosted`: host-owned routes can call the adapter helpers while the package still owns the authorization interaction state.
