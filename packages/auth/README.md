# @taico/auth

OAuth 2.1 for Node apps, in two halves you can use separately:

- **Resource server**: verify access tokens, check audience and scopes, answer with the right `WWW-Authenticate` challenge, publish protected-resource metadata. This is what most apps need, and it is small.
- **Authorization server**: signing keys, clients, authorize / consent / token / refresh / introspect / revoke, dynamic client registration, client ID metadata documents, discovery, and browser login sessions.

The core is framework-free and depends only on [`jose`](https://github.com/panva/jose). Frameworks and databases are thin adapters behind subpath imports, and are optional peer dependencies: a Hono app installs neither Nest nor TypeORM.

| Import | Contents | Needs |
|---|---|---|
| `@taico/auth` | Core: verifier, key manager, signer, `ResourceServer`, `OAuthServer`, ports, errors | `jose` |
| `@taico/auth/nest` | `AuthModule`, `AccessTokenGuard`, `ScopesGuard`, `@RequireScopes`, `@Public`, `@CurrentAuth` | `@nestjs/common`, `@nestjs/core` |
| `@taico/auth/nest-ws` | `WsAccessTokenGuard`, `WsScopesGuard` for socket.io gateways | `@nestjs/common`, `@nestjs/core` |
| `@taico/auth/express` | `requireAuth`, `requireScopes`, `protectedResourceMetadata`, `authRouter` | nothing (typed against Node's HTTP) |
| `@taico/auth/hono` | `bearerAuth`, `requireScopes`, `protectedResourceMetadata`, `authRoutes`, `authApp` | `hono` |
| `@taico/auth/typeorm` | Entities, store adapters, migration | `typeorm` |
| `@taico/auth/memory` | In-memory stores for tests and prototypes | nothing |
| `@taico/auth/idp-local` | Email + password identity provider | nothing (scrypt from Node; bcrypt optional) |
| `@taico/auth/client` | OAuth client: discovery, registration, PKCE, refresh, loopback callback, credential store | nothing |

Requires Node 20 or later. ESM only.

## Resource server: trust another issuer's tokens

An app that accepts tokens minted elsewhere (by Taico, or by another app running this package) needs three facts: who the issuer is, where its keys are, and which audience the app answers to.

```ts
import { createResourceServer, exactResource, remoteJwks } from '@taico/auth';

const auth = createResourceServer({
  issuer: 'https://taico.example.com',
  jwks: remoteJwks('https://taico.example.com/.well-known/jwks.json'),
  audience: exactResource('https://notes.example.com/mcp'),
  baseUrl: 'https://notes.example.com',
});
```

### Express

```ts
import { protectedResourceMetadata, requireAuth, requireScopes } from '@taico/auth/express';

app.use(protectedResourceMetadata(resources, { authorizationServers: ['https://taico.example.com'] }));
app.get('/mcp', requireAuth(auth), requireScopes('notes:read'), (req, res) => {
  res.json({ subject: req.auth.subject });
});
```

### Hono

```ts
import { bearerAuth, requireScopes } from '@taico/auth/hono';

app.use('/mcp/*', bearerAuth(auth), requireScopes('notes:read'));
app.get('/mcp', (c) => c.json({ subject: c.get('auth').subject }));
```

### NestJS

```ts
import { AccessTokenGuard, AuthExceptionFilter, AuthModule, RequireScopes, ScopesGuard } from '@taico/auth/nest';

@Module({
  imports: [AuthModule.forResourceServer(auth)],
  providers: [{ provide: APP_FILTER, useClass: AuthExceptionFilter }],
})
export class AppModule {}

@Controller('notes')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class NotesController {
  @Get()
  @RequireScopes('notes:read')
  list(@CurrentAuth() auth: AuthContext) { /* ... */ }
}
```

The guards throw `AuthError`s. `AuthExceptionFilter` answers them with a status and a Bearer challenge; an app with its own error format can map them itself (each error has a stable `code`) and build the header with `buildChallenge`.

### What is checked

- Signature, against the issuer's keys. Keys are cached; a token naming an unknown key triggers one rate-limited refresh.
- `iss`, `exp`.
- **Revocation**, when a `revocation` checker is configured: a revoked `jti` fails on the next request, not when the token expires.
- **Audience**, through an `AudiencePolicy`:
  - `exactResource(url)`: tokens minted for this resource URL.
  - `requestUrlAudience()`: a token is only good on the URL it names. For a host serving several resources.
  - `literalAudience('value')`: non-URL audiences.
  - `anyAudience(a, b)`: any of the above.
- Scopes, per route.

### Scope claim format

Tokens carry `scope` as a space-delimited string, as RFC 9068 specifies. `parseScope` also reads the array form, so tokens minted before the change keep working until they expire. Always read scopes through `AuthContext.scopes` or `parseScope`, never from the claim directly.

## Authorization server

```ts
import { OAuthServer, ScopeRegistry } from '@taico/auth';
import { localIdp } from '@taico/auth/idp-local';
import { authEntities, typeormStores, typeormUserStore } from '@taico/auth/typeorm';

const server = new OAuthServer({
  config: {
    issuer: 'https://auth.example.com',
    consentUrl: 'https://auth.example.com/consent', // a page of your UI
  },
  stores: typeormStores(dataSource),
  resources,                                         // ResourceRegistry: what tokens are for
  identity: localIdp(typeormUserStore(dataSource)),  // who the users are
  claims: { claimsFor: async (subject) => ({ role: subject.role }) },
  scopes: new ScopeRegistry(allScopes),
});
```

Mount it:

```ts
app.use(express.json());
app.use(authRouter(server));                      // Express
app.use('*', authRoutes(server));                 // Hono
AuthModule.forRoot({ server })                    // Nest (mounted as middleware)
```

Endpoints (under `config.basePath`, default `/oauth`):

| Endpoint | Purpose |
|---|---|
| `GET /.well-known/oauth-authorization-server` | RFC 8414 metadata |
| `GET /.well-known/jwks.json` | Public signing keys |
| `GET /.well-known/oauth-protected-resource/<path>` | RFC 9728 metadata for a registered resource |
| `GET /oauth/authorize` | Starts a grant, redirects to `consentUrl?grant_id=...` |
| `GET /oauth/consent/:grantId` | What the consent screen shows |
| `POST /oauth/consent` | The user's decision (`grant_id`, `approved`); needs a session |
| `POST /oauth/token` | `authorization_code` and `refresh_token` grants |
| `POST /oauth/register` | Dynamic client registration (RFC 7591), public clients only |
| `POST /oauth/introspect`, `POST /oauth/revoke` | RFC 7662, RFC 7009 |
| `POST /oauth/login`, `/oauth/session/refresh`, `/oauth/logout`, `GET /oauth/session` | Browser session in HttpOnly cookies |

Every method on `OAuthServer` takes and returns plain data, so you can build your own routes on it instead (`server.authorize()`, `server.decide()`, `server.token()`, ...).

### Security properties

- PKCE with S256 is required. There are no client secrets: clients are public, or sign assertions with `private_key_jwt`.
- Authorization codes and refresh tokens are stored as SHA-256 hashes, are single-use, and the single use is enforced atomically in the store (`redeemCode`, `consume`), so two racing requests cannot both win.
- Refresh tokens rotate. Presenting a rotated-out token revokes the whole grant (for a session token: every session of that user). This holds when two requests present the same token at once: one is served, and what it was given is revoked with the rest. The same applies to two requests racing on one authorization code.
- A token's audience is the resource the grant was made for, never a value the client sent at the token endpoint.
- `resolveSession` only accepts tokens minted for a browser session, so a client's or agent's token cannot approve a consent.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when the issuer is https.
- The session POSTs (`login`, `session/refresh`, `logout`, and `consent` when it is authenticated by the cookie) are refused with 403 unless the request's `Origin` is the issuer's or one of `trustedOrigins`. When there is no `Origin`, the origin of `Referer` is checked instead; a request with neither is refused. A non-browser caller of these routes must send `Origin` itself. `consent` with a session token in an `Authorization: Bearer` header skips the check, because a browser never attaches that header on its own.
- Client ID metadata documents are fetched over https from public addresses only, without following redirects, with a size cap and a timeout.

### Hooks: running your own step after consent

```ts
hooks: {
  afterConsent: async (grant) => {
    if (needsDownstreamAccount(grant)) {
      return { redirectTo: downstreamAuthorizeUrl(grant) };
    }
    return { continue: true };
  },
}
```

When the user comes back, call `server.completeAuthorization(grant.id)`; it returns the redirect to the client with the code. This is how a host brokers connections to downstream providers without that logic living in the package.

### Issuing tokens directly

```ts
const { token, jti } = await server.issueToken({
  subject: agentId,
  scopes: ['tasks:read'],
  ttlSeconds: 30 * 24 * 3600,
  record: { name: 'CI token', issuedBy: userId }, // listable and revocable
});
await server.revokeIssuedToken(jti);               // refused from the next request on
```

## Ports

The package owns no database and no user model. The host supplies them through these interfaces, or picks an adapter:

| Port | What it is | Adapters |
|---|---|---|
| `KeyStore` | Signing keys | memory, typeorm |
| `ClientStore` | OAuth clients | memory, typeorm |
| `GrantStore` | Authorizations in progress and granted | memory, typeorm |
| `RefreshTokenStore` | Hashed refresh tokens (grants and sessions) | memory, typeorm |
| `IssuedTokenStore` | Recorded and revoked access tokens | memory, typeorm |
| `ResourceRegistry` | What tokens can be minted for | `staticResources([...])`, or your own |
| `IdentityProvider` | Authenticates users, looks up subjects | `localIdp(userStore)`, or your own |
| `ClaimsProvider` | Extra claims per subject | your own |

Subject and resource IDs are opaque strings to the package. The TypeORM tables (`auth_*`) have no foreign keys into host tables; add them in your own migrations if you want them.

```ts
new DataSource({
  entities: [...yourEntities, ...authEntities],
  migrations: [...yourMigrations, CreateAuthTables1760000000000],
});
```

## Client

For CLIs, workers and tests:

```ts
import { fileCredentialStore, OAuthClient, TokenManager } from '@taico/auth/client';

const tokens = new TokenManager({
  client: new OAuthClient({ issuer }),
  issuer,
  store: fileCredentialStore('~/.myapp/credentials.json'),
  clientName: 'My CLI',
  scope: 'notes:read',
  resource: 'https://notes.example.com/mcp',
});
const accessToken = await tokens.getAccessToken(); // registers, opens the browser flow, refreshes
```

## Differences from Taico's built-in authorization server

Taico's backend uses this package for verification, keys, signing and guards. Its own authorization endpoints are older and differ in two ways a host should know about:

- Taico exposes one authorization server per MCP server, at path-shaped URLs (`/auth/authorize/mcp/:id/:version`). This package has **one issuer**, and the resource is chosen with the RFC 8707 `resource` parameter (or `config.defaultResource`).
- Taico's brokering of downstream connections stays in Taico. Here it is the `afterConsent` hook.

## Development

```bash
npm -w packages/auth run build
npm -w packages/auth test     # builds, then runs node:test against the built package
```

## License

PolyForm-Small-Business-1.0.0
