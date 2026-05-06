# @taico/authorization-server

Standalone authorization server primitives for Taico-style REST, web, and MCP applications.

The package exposes a transport-neutral core, an Express adapter, MCP resource registration, JWT/JWKS handling, hosted login and consent flows, and a SQLite storage adapter.

Mount the Express adapter at the app root. The adapter owns its configured `basePath` (default `/auth`) so it can expose RFC 8414 pathful issuer discovery at `/.well-known/oauth-authorization-server/auth` while serving OAuth endpoints under `/auth`.
