/*
Authenticates an incoming HTTP request with its access token (Authorization:
Bearer, or the session cookie) and attaches a typed AuthContext to
`res.locals.auth`. The guard itself lives in `@taico/auth`; it verifies against
the ResourceServer that AuthGuardsModule configures for Taico. Failures are
AuthErrors, which the global exception filter turns into a response with a
WWW-Authenticate challenge.
*/
export { AccessTokenGuard } from '@taico/auth/nest';
