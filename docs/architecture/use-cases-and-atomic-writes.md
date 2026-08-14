# Use Cases and Atomic Writes

## Decision

All commands that create, update, delete, or transition persistent business state are owned by an application **use case**. A use case owns the transaction boundary and records durable post-commit work. Controllers, MCP handlers, gateways, and schedulers call use cases; they do not coordinate repositories or cross-service writes directly.

```
Transport → Use case → domain services / repositories → transaction + outbox
                                      ↓
                             post-commit workers
```

## Responsibilities

- **Transport:** authentication, request mapping, response/error mapping. No business transaction orchestration.
- **Use case:** validates the command, loads state, enforces the business invariant, writes all affected rows in one transaction, and writes outbox records in that transaction.
- **Domain service:** focused reusable business rules. It accepts the use case's persistence context when it reads/writes state; it does not silently start another transaction.
- **Repository:** persistence primitives such as `claim`, `insertIfAbsent`, `updateIfVersion`, relation changes, and guarded delete. Database constraints remain authoritative.
- **Outbox worker:** idempotently performs events, projections, chat work, notifications, and external OAuth calls after commit. Never hold a DB transaction while calling a network service or LLM.

## Concurrency rules

- A simple one-statement insert/update/delete is atomic; do not add a transaction merely by habit.
- Multi-row or read-then-write business invariants use one use-case transaction.
- User-edited aggregates use optimistic concurrency: mutation commands carry `expectedRowVersion`; the write predicate checks it and returns a conflict when stale. `@VersionColumn` alone is not a compare-and-swap check.
- Claims, counters, appends, and state transitions use conditional SQL (`UPDATE ... WHERE prior_state ...`) or an upsert.
- Pre-checks provide friendly errors only. Unique keys, foreign keys, check constraints, and affected-row checks decide correctness.

## Migration rule

Do not rewrite every service first. Introduce the foundation, then move one risky workflow at a time. The first migrations are task/tag/project, thread/context, and OAuth code/refresh-token state transitions. Retain compatibility façades only as thin delegators until callers move.

## Testing rule

For each use case, test rollback after each write, competing requests from independent database connections, stale-version conflicts, and idempotent outbox delivery.
