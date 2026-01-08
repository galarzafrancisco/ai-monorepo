Purpose: thin guards that wire extractor + validator + context + surface behavior.

Guards should be small and intentional—each one has a single contract.

bearer-access-token.guard.ts

uses bearer extractor + validator

sets AuthContext

cookie-access-token.guard.ts

uses cookie extractor + validator (same validator)

sets AuthContext

mcp-auth.guard.ts

uses bearer extractor + validator

sets WWW-Authenticate with resource_metadata=...

ensures errors are MCP-friendly (or throws MCP-specific exceptions)

composed/

optional: any-auth.guard.ts (explicitly “bearer OR cookie”) — only if you want endpoints that accept both

Why: keeps “MCP is special” contained to one guard without polluting the core validator.