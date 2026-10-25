# Running backend e2e tests on PGlite

Backend e2e tests normally need a PostgreSQL server (`POSTGRES_ADMIN_URL`, default
`postgresql://taico:taico@127.0.0.1:5432/postgres`). To run without a container:

```bash
npm -w apps/backend run test:e2e:pglite      # same as TEST_DB=pglite npm -w apps/backend run test:e2e
```

`apps/backend/test/run-e2e.mjs` then starts an in-process [PGlite](https://pglite.dev)
(Postgres compiled to WASM) in a temp dir, with `pgvector`, `pg_trgm` and `pgcrypto`,
exposes it with `@electric-sql/pglite-socket`, and points `DATABASE_URL` at it. Migrations
run as usual. The full suite takes ~25s.

## Caveats

- PGlite is single-session. The socket server interleaves extended-protocol messages
  from concurrent connections, which breaks (`bind message supplies N parameters`).
  The runner sets `DATABASE_POOL_MAX=1` to keep one pooled connection. Never use this
  in production; the env var is only an optional pool cap.
- Because of the single connection, code that opens a second connection while a
  transaction is held will deadlock. Tests do not currently do this.
- One run in five showed a flaky `thread-read-state` failure; not seen on isolated reruns.
- CI still uses the real `pgvector/pgvector` Postgres 16 service, which is the
  authoritative target. PGlite is a fast local option.
