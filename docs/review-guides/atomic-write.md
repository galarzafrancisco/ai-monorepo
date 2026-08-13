# Atomic Write Review Guide

Use this guide for a command that writes related records, enforces a read-dependent invariant, or schedules post-commit work.

- All writes required to preserve the command's business invariant commit or roll back together.
- A command whose mutation needs no dependent writes and no prior read performs that mutation in one SQL statement.
- Each read-then-write mutation uses an expected-version predicate or a predicate for the required prior state.
- Each claim, counter update, append, or state transition uses a conditional SQL statement or an upsert.
- Database constraints enforce every uniqueness, reference, and value invariant that the command depends on.
- A pre-check is not the only enforcement of a database constraint.
- A delete that depends on related records checks those records and deletes the target in the same transaction, unless a foreign-key policy enforces the condition.
- A command that schedules a post-commit event or projection inserts its outbox record in the transaction that writes the business state.
- Each outbox consumer uses a stable deduplication key before performing its externally observable effect.
- No database transaction includes a network, OAuth, chat, or LLM call.
- A command that schedules an external effect persists the state needed to retry that effect after a process failure.
- A test for a command with multiple writes proves that failure of each write rolls back the command's earlier writes.
- A test for a command with a concurrency predicate proves that competing commands produce one valid result or the documented idempotent result.
- A test for an expected-version predicate proves that a stale version returns a domain conflict.
- A test for an outbox consumer proves that replaying the same outbox record does not repeat its externally observable effect.
