# Use Case and Atomic Write Review Guide

Use this checklist for every backend command that changes persisted state.

## Ownership

- [ ] A named use case owns the business command; controllers, MCP handlers, gateways, and schedulers do not coordinate multiple repositories/services.
- [ ] The use case declares the aggregate/invariant it protects and its transaction boundary is obvious.
- [ ] Domain services are focused collaborators, not broad cross-service orchestrators.

## Atomicity and concurrency

- [ ] All rows/join rows needed for the command commit or roll back together.
- [ ] A single-statement operation uses conditional SQL/upsert where that is safer than read–modify–save.
- [ ] Read-then-write edits use an expected version or conditional prior-state predicate.
- [ ] Unique/FK/check constraints enforce the invariant; pre-checks only improve error messages and constraint failures are translated.
- [ ] Deletes are guarded by the same transaction as dependency checks, or protected by database referential policy.

## Side effects

- [ ] The transaction writes an outbox record for required post-commit events/projections.
- [ ] Consumers are idempotent and have a deduplication key.
- [ ] Network, OAuth, chat, and LLM calls occur after commit, with a retryable persisted state; no transaction spans them.

## Tests

- [ ] Failure after each write leaves no partial aggregate.
- [ ] Concurrent commands prove one valid winner (or correct idempotent result) without lost updates.
- [ ] Stale versions and invalid transitions return domain conflicts.
- [ ] Outbox replay does not duplicate effects.
