# 01 — Persistence foundation

Depends on: none. Blocks: 02–07.

Create the shared transaction, optimistic-concurrency, outbox, and concurrency-test conventions before converting business flows.

Current status: transactional use cases, the outbox entity/migration/writer/dispatcher, and compatibility projectors are implemented. Expected-version command contracts, reusable repository helpers, and a two-connection SQLite race harness remain follow-up work.

Deliverables:

- [x] Application/use-case transaction convention based on `DataSource.transaction`, with an explicit manager passed to collaborators.
- Repository helpers for conditional version update, relation add/remove, guarded delete, conflict translation, and SQLite upsert.
- [x] `outbox_events` migration/entity/writer/dispatcher with retry and a compatibility in-process-event bridge. Consumer idempotency and multi-node claim coordination remain follow-up work.
- Standard error types for stale write, unique conflict, and invalid transition. Mutation DTOs for human-edited aggregates include `expectedRowVersion` where compatible API versioning permits it.
- A two-connection SQLite race/failure-injection test harness and transaction/outbox test helpers.

Acceptance criteria:

- A thrown error after any write inside a sample use case leaves no rows/join rows/outbox rows from that use case.
- Two same-version updates produce exactly one success and one conflict.
- An outbox record and its aggregate change commit or roll back together; replaying delivery does not duplicate its projection.

Do not put network calls inside the transaction runner.
