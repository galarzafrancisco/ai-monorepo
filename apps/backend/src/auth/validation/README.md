Purpose: validate and decode JWTs (JWKS, issuer/audience, clock skew, etc).

jwt-validation.service.ts

your current JwtValidationService lives here

should validate canonical access tokens

jwks/

jwks-client.service.ts or provider wrapper

caching config, key rotation, etc

errors/

token-errors.ts (e.g. TokenExpired, InvalidSignature, InvalidAudience, etc)

Why: every surface (REST/MCP/Web) reuses the same verifier.