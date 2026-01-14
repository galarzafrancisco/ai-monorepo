Purpose: define the canonical token payload shape and helpers.

claims.types.ts

AccessTokenClaims (sub, iss, aud, exp, iat, scope/scp, client_id, etc)

Scope type, Scopes helper types if you want

scopes.ts

scope constants (string union or const object)

helpers like parseScopeString("a b c") -> string[] and hasScopes(...)

Why: keeps “what does a token mean” separate from “how do we extract it”.