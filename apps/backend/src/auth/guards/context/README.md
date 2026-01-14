Purpose: the unified auth context you attach to request / response locals.

auth-context.types.ts

AuthContext (token, claims, scopes, subject, maybe actor/client/app)

optional: Principal / Actor concept

auth-context.storage.ts

one place that defines where you store it (e.g. res.locals.auth or req.auth)

helper functions: setAuthContext(res, auth) / getAuthContext(req/res)

Why: stops the “MCP puts it on res.locals, web puts it on req.user” divergence.