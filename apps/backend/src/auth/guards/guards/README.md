# Guards

The guards are implemented in `@taico/auth` (`packages/auth`) and re-exported here so controllers keep importing them from one place:

| Guard | From | What it does |
|---|---|---|
| `AccessTokenGuard` | `@taico/auth/nest` | Verifies the access token (Bearer header or session cookie), checks its audience against the request URL, and puts the `AuthContext` on `res.locals.auth` |
| `ScopesGuard` | `@taico/auth/nest` | Enforces `@RequireScopes(...)` |
| `WsAccessTokenGuard` | `@taico/auth/nest-ws` | The same for a socket.io handshake; first-party tokens only |
| `WsScopesGuard` | `@taico/auth/nest-ws` | Enforces `@RequireScopes(...)` on gateway handlers |

They verify against the `ResourceServer` that `AuthGuardsModule` builds: Taico's issuer and keys, the audience rules in `auth/core/resource-audience.ts`, and revocation through `issued_access_tokens`.

Failures are thrown as `AuthError`s with the codes from `@taico/errors`. The global `ProblemDetailsFilter` turns them into a problem-details body plus a `WWW-Authenticate` challenge; the guards never write to the response themselves.

See `docs/how-to-guides/auth-package.md`.
