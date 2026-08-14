# 04 — Identity, agents, permissions, and configuration

Depends on: 01. Can proceed in parallel with 02/03/05.

- [x] Agent/actor creation is transactional with slug-conflict translation and a durable creation event.
- [x] User/actor creation, agent patching, and agent soft deletion are transactional; expected-version updates remain.
- Replace slug generation and worker heartbeat find-then-save with database-conflict retry/upsert.
- Decide and enforce lifecycle policy for deleting agents, actors, permissions, secrets, and chat providers.
- [x] Chat-provider API-key creation/update (secret + provider) is a single transaction.
- Preserve the existing transactional permission scope replacement, but move mutable validation inside the transaction or add robust constraints.
- Add partial unique constraint for a single active chat provider and retain the current transaction.

Acceptance criteria: no orphan actor exists after failed user/agent creation; concurrent worker sightings cannot duplicate worker rows; provider and secret cannot become mismatched.
