# SQLite to PostgreSQL migration

Taico uses PostgreSQL for application entities and provider-independent AI SDK thread chat history. Historical Google ADK session tables can remain in the database, but thread chat no longer reads or writes them.
The application schema is created by the PostgreSQL baseline migration and subsequent registered migrations.

## Safety model

- Stop Taico before the final snapshot so no writes can occur during cutover.
- Never point the importer at a PostgreSQL database containing application data.
- The importer opens SQLite files read-only and performs the PostgreSQL import in one transaction.
- Broken nullable references are set to `NULL`; broken required rows and their dependants are retained as JSON in `migration_archive.rows`.
- Legacy SQLite tables are also retained in `migration_archive.rows`.
- Keep the original SQLite files and final snapshots until PostgreSQL has been verified and separately backed up.

## Run

Create an empty PostgreSQL database, apply the baseline, then run:

```bash
SQLITE_PATH=/path/to/database.sqlite \
CHAT_SQLITE_PATH=/path/to/database-chat.sqlite \
RECOVERY_SQLITE_PATH=/path/to/database.sqlite.bk.2 \
DATABASE_URL='postgresql://taico:password@localhost:5432/taico' \
npm -w apps/backend run migrate:sqlite-to-postgres
```

Use a dedicated, non-superuser application login. In Kubernetes, store
`DATABASE_URL` in the `taico-database` Secret, never in a ConfigMap or Git.

After import, start Taico with `TYPEORM_SCHEMA_MODE=migrate`, verify health and
sign-in, inspect representative tasks, threads, and comments, then compare the
reported counts with the source snapshot before directing traffic to it.
