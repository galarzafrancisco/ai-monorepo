# @taico/auth

OAuth 2.1 for Node apps, in two halves you can use separately:

- **Resource server**: verify access tokens, check audience and scopes, answer with the right `WWW-Authenticate` challenge, publish protected-resource metadata. This is what most apps need, and it is small.
- **Authorization server**: signing keys, clients, authorize / consent / token / refresh / introspect / revoke, dynamic client registration, client ID metadata documents, discovery, and browser login sessions.

The core is framework-free and depends only on [`jose`](https://github.com/panva/jose). Frameworks and databases are thin adapters behind subpath imports, and are optional peer dependencies: a Hono app installs neither Nest nor TypeORM.

| Import | Contents | Needs |
|---|---|---|
| `@taico/auth` | Core: verifier, key manager, signer, `ResourceServer`, `OAuthServer`, ports, errors | `jose` |
| `@taico/auth/nest` | `AuthModule`, `AccessTokenGuard`, `ScopesGuard`, `@RequireScopes`, `@Public`, `@CurrentAuth`, `@UseResourceServer` | `@nestjs/common`, `@nestjs/core` |
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
// or one authorization server per resource, as with Taico's per-MCP-server URLs:
// { authorizationServers: (resource) => [`https://taico.example.com/auth/mcp/${resource.identifier}`] }
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

An app whose authorization server is elsewhere serves its RFC 9728 metadata with the `metadata` option, mounted as middleware outside any global prefix:

```ts
AuthModule.forRoot({
  resourceServer: auth,
  metadata: { resources, authorizationServers: ['https://taico.example.com'] },
})
```

#### Several resources in one Nest app

Two ways, depending on whether the resources share an issuer:

- **One resource server, path-bound audience.** `audience: resourceAudience(notesUrl, filesUrl)` accepts a token only on the resource URL it was minted for and the paths below it, so a token for `/mcp/notes` is refused on `/mcp/files`. Works in every framework, not only Nest.
- **Named resource servers.** For resources with different issuers or settings:

  ```ts
  AuthModule.forRoot({ resourceServers: { notes: notesAuth, files: filesAuth }, metadata: { ... } })

  @Controller('mcp/files')
  @UseResourceServer('files')
  @UseGuards(AccessTokenGuard, ScopesGuard)
  export class FilesController {}
  ```

  `resourceServer` stays the default for routes that name none; without one, such a route fails with a 500 rather than guessing. The exception filter points the challenge at the metadata of the resource server the route used. The websocket guard honours `@UseResourceServer` too.

With `forRoot({ server, resource })`, pass `resource` (the URL of the protected resource your routes make up) so the challenge points at its metadata. `forResourceServer` takes it from the `exactResource` policy.

The guards throw `AuthError`s. `AuthExceptionFilter` answers them with a status and a Bearer challenge; an app with its own error format can map them itself (each error has a stable `code`) and build the header with `buildChallenge`.

### Where a 401 sends the client

Each 401 and 403 carries `WWW-Authenticate: Bearer resource_metadata="..."`, the RFC 9728 pointer a client follows to find the authorization server. It names the metadata of the **resource** the request falls under, not the request path, so `/mcp/notes/1` and `/api/notes` both point at `/.well-known/oauth-protected-resource/mcp` when the resource is `https://notes.example.com/mcp`.

The resource comes from the `exactResource` policy, or from the `resource` option when the audience policy names none (`resource: 'https://notes.example.com/mcp'`, or a list; the longest URL a request falls under wins, otherwise the first). With neither, as with `requestUrlAudience()`, the request URL is taken to be the resource.

### The MCP TypeScript SDK

`AuthContext` is also a valid `AuthInfo` of `@modelcontextprotocol/sdk` (`token`, `clientId`, `scopes`, `expiresAt`, `resource`, `extra`). Both libraries use `req.auth`, so put `requireAuth` in front of a `StreamableHTTPServerTransport` and tools receive `extra.authInfo` with no conversion:

```ts
app.post('/mcp', requireAuth(auth), async (req, res) => {
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body); // reads req.auth
});
```

`resource` is only set when the token was minted for the resource the request falls under. `extra` holds `subject` and the full `claims`.

### What is checked

- Signature, against the issuer's keys. Keys are cached; a token naming an unknown key triggers one rate-limited refresh.
- `iss`, `exp`.
- **Revocation**, when a `revocation` checker is configured: a token fails on the next request, not when it expires, if its `jti` was revoked or if the grant or browser session it was issued under (its `sid` claim) was. `server.resourceServer()` is always configured this way. A resource server in another process that only fetches the issuer's keys is not: give it a `revocation` checker that reads the issuer's store, or have it call the introspection endpoint, or rely on the access token lifetime (10 minutes by default).
- **Audience**, through an `AudiencePolicy`:
  - `exactResource(url)`: tokens minted for this resource URL.
  - `resourceAudience(a, b)`: a token is only good under the resource URL it was minted for (that URL and the paths below it; the longest match decides). For a host serving several resources. Requests under none of them, or whose path has dot segments or encoded slashes, are refused.
  - `requestUrlAudience()`: a token is only good on the exact URL it names.
  - `literalAudience('value')`: non-URL audiences.
  - `anyAudience(a, b)`: any of the above.
- Scopes, per route.

### Claims

`AuthContext.claims` holds the standard claims plus what the issuer added. Name the extra ones with the type parameter: `auth.authenticate<TaicoClaims>(...)` for tokens from Taico (`actor_id`, `actor_slug`, `actor_type`, `email`, `displayName`, ...), or `IdentityClaims` (`name`, `email`, `preferred_username`, the OpenID Connect names) for a `ClaimsProvider` that follows them. These describe who the user is. Scopes record what the user approved for the client, not what the user may do: per-user permissions are the resource server's job.

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
    // consentUrl: 'https://app.example.com/consent', // your own page; defaults to the built-in one
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
| `GET /oauth/consent?grant_id=` | Built-in consent page (the default `consentUrl`); sends the user to the login page first |
| `GET /oauth/login?return_to=` | Built-in login page |
| `GET /oauth/consent/:grantId` | What the consent screen shows, as JSON, for your own page |
| `POST /oauth/consent` | The user's decision (`grant_id`, `approved`); needs a session |
| `POST /oauth/token` | `authorization_code` and `refresh_token` grants |
| `POST /oauth/register` | Dynamic client registration (RFC 7591), public clients only |
| `POST /oauth/introspect`, `POST /oauth/revoke` | RFC 7662, RFC 7009 |
| `POST /oauth/login`, `/oauth/session/refresh`, `/oauth/logout`, `GET /oauth/session` | Browser session in HttpOnly cookies |

`POST /oauth/login` answers JSON to a JSON request. A form post (from the built-in page) is answered with a redirect to `return_to`, which must be a path on the issuer; anything else goes to `/`.

### Built-in pages

So that the flow works with no UI of your own, the login and consent pages are served by default: plain HTML forms with no script, an escaped rendering of everything the client registered (its name is its own claim, and the page says so), and a `Content-Security-Policy` with `frame-ancestors 'none'` so the consent buttons cannot be clickjacked. Point `consentUrl` at your own page and pass `pages: false` (`authRouter(server, { pages: false })`) to turn them off.

Every method on `OAuthServer` takes and returns plain data, so you can build your own routes on it instead (`server.authorize()`, `server.decide()`, `server.token()`, ...).

### Security properties

- PKCE with S256 is required. There are no client secrets: clients are public, or sign assertions with `private_key_jwt`.
- Authorization codes and refresh tokens are stored as SHA-256 hashes, are single-use, and the single use is enforced atomically in the store (`redeemCode`, `consume`), so two racing requests cannot both win.
- Refresh tokens rotate. Presenting a rotated-out token revokes the whole grant (for a session token: every session of that user): its refresh tokens and its access tokens.
- That holds when two requests present the same token at once, and for two requests racing on one authorization code. Either neither is served, or one is and what it was given is refused from then on. A client that sends the same token twice in parallel therefore loses its grant and has to authorize again.
- Access tokens are revoked through their `sid` claim, which names the grant or session. The revocation is an entry for that `sid` in the `IssuedTokenStore`, so it also applies to an access token that a racing request signs after the entry was written. Logout and `POST /oauth/revoke` with a refresh token end access tokens the same way.
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
| `IssuedTokenStore` | Recorded access tokens, and revocations: of one token (`jti`) or of a grant or session (`sid`) | memory, typeorm |
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

For CLIs, workers and tests. The resource URL is enough: the client calls it, follows `resource_metadata` in the 401 (or the well-known locations) and reads the authorization server from the metadata, the way MCP clients do.

```ts
import { fileCredentialStore, TokenManager } from '@taico/auth/client';

const tokens = new TokenManager({
  resource: 'https://notes.example.com/mcp',
  store: fileCredentialStore('~/.myapp/credentials.json'),
  clientName: 'My CLI',
  // scope defaults to what the resource's challenge or metadata asks for
});
const accessToken = await tokens.getAccessToken(); // discovers, registers, opens the browser flow, refreshes
```

Pass `issuer` (or a `client`) to skip discovery. `discoverResource(url)` runs the discovery step on its own. It refuses metadata whose `resource` the URL does not fall under, so a resource cannot send your tokens somewhere else.

`fileCredentialStore` expands a leading `~` to the home directory. When a refresh token is refused, `TokenManager` runs the browser flow again with the client it already registered (its loopback redirect URI matches on any port), so re-authorizing does not leave another client on the server; it registers again only if the server answers `invalid_client`.

Credentials are stored **per issuer and resource**, so two apps behind the same authorization server each keep their own tokens and never receive the other's. A custom `CredentialStore` gets `read(issuer, resource)`; `credentialKey(issuer, resource)` builds the key the built-in stores use.

## Differences from Taico's built-in authorization server

Taico's backend uses this package for verification, keys, signing and guards. Its own authorization endpoints are older and differ in two ways a host should know about:

- Taico exposes one authorization server per MCP server, at path-shaped URLs (`/auth/authorize/mcp/:id/:version`). This package has **one issuer**, and the resource is chosen with the RFC 8707 `resource` parameter (or `config.defaultResource`).
- Taico's brokering of downstream connections stays in Taico. Here it is the `afterConsent` hook.
- Taico's per-MCP-server authorize endpoint does not yet require the `resource` parameter; a client that leaves it out gets a token for the server the URL names. The package's client and the MCP SDK always send it and check the resource metadata, so they are not affected.

## Development

```bash
npm -w packages/auth run build
npm -w packages/auth test     # builds, then runs node:test against the built package
```

## License

PolyForm-Small-Business-1.0.0
