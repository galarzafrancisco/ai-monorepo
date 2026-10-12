# Test fixtures

Documents captured from real clients, so the tests check what those clients
actually send and not only what we assume they send.

## `chatgpt-client-metadata.json`

The Client ID Metadata Document ChatGPT serves for a custom MCP connector,
captured on 2026-10-12 from `https://chatgpt.com/oauth/<connector id>/client.json`
(served with `cache-control: public, max-age=300`).

It is the document as served, with one change: the connector id, which appears
in `client_id` and in the redirect URI, is replaced by `EXAMPLEconn1`. The id
is not a secret, but it identifies one person's connector.

The key set at its `jwks_uri` is not stored. It held one key of this shape:

```json
{ "kty": "RSA", "kid": "cimd-20260428030119", "use": "sig", "alg": "RS256", "n": "…", "e": "AQAB" }
```

Tests generate their own RSA key in that shape, because signing a token
request needs the private key, which only ChatGPT has.

To refresh the fixture, open ChatGPT's "Add custom MCP server" dialog, copy the
"CIMD client metadata URL", fetch it, and replace the connector id.
