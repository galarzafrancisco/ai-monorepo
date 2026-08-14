# 07 — Bootstrap, migration, and rollout

Depends on: 02–06.

- Replace multi-replica `AppInitRunner` mutation/repair work with migrations and one-shot, lock-protected maintenance commands using conflict-safe upserts.
- Run the pre-constraint data audit from the main audit and repair only with a reviewed, reversible plan.
- Add observability: transaction conflict rate, outbox backlog/age/retries, state-transition rejection rate, token-reuse attempts, and queue reconciliation effects.
- Release in slices: foundation shadow mode → one aggregate family → security/OAuth flows → legacy cleanup. Keep compatibility event bridge until all consumers use the outbox.
- Document rollback plans for each schema migration, especially SQLite table-rebuild migrations.

Acceptance criteria: two backend replicas can start safely; deployment does not silently repair/mutate production data; dashboards demonstrate transaction/outbox health before old paths are removed.
