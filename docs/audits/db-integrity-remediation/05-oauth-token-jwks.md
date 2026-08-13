# 05 — OAuth, token, and JWKS state machines

Depends on: 01. Security priority: highest.

- [x] Client registration, its authorization journey, and connection flows are created in one transaction.
- [x] Authorization request, consent, and code issuance are conditional transactions. Downstream callback transitions still need the same treatment.
- [x] MCP authorization-code consumption plus both refresh-token rotations are transactional conditional transitions.
- [ ] Add token-family/reuse policy and tests for replay telemetry.
- Move downstream HTTP token exchange/refresh to a persisted job/lease model; do not retain a transaction over `fetch`.
- [x] JWKS installs generated key material through a transaction and enforces one active key with a partial unique index.
- Add indexes/constraints required by token lookup, single-use codes, flow states, and per-server connection friendly-name policy.

Acceptance criteria: two concurrent exchanges of one authorization code or refresh token yield one success; duplicate callback/refresh attempts cannot overwrite rotated credentials; process crash around any transition is retryable without credential reuse.
