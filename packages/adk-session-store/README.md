# @taico/adk-session-store

[![Socket Badge](https://badge.socket.dev/npm/package/@taico/adk-session-store/0.4.1)](https://badge.socket.dev/npm/package/@taico/adk-session-store/0.4.1)

PostgreSQL and SQLite session storage for Google ADK. Taico production uses
`PostgresSessionService`; the SQLite implementation remains available to package
consumers that need an embedded store.

`SqliteSessionService` extends ADK `BaseSessionService` and is intended as a drop-in replacement for `InMemorySessionService` when you need persistence.

## Installation

```bash
npm install @taico/adk-session-store
```

## Usage

### PostgreSQL

```ts
import { PostgresSessionService } from '@taico/adk-session-store';

const sessionService = new PostgresSessionService({
  connectionString: process.env.DATABASE_URL!,
});
```

The application migration must create the `adk_*` tables before this service is
used.

### SQLite

```ts
import { Runner } from '@google/adk';
import { SqliteSessionService } from '@taico/adk-session-store';

const sessionService = new SqliteSessionService({
  filename: './adk-sessions.sqlite',
});

const runner = new Runner({
  appName: 'my-app',
  agent,
  sessionService,
});
```

Use in-memory SQLite by omitting `filename` or by setting `filename: ':memory:'`.

## API

- `new PostgresSessionService({ connectionString, ssl? })`
- `new SqliteSessionService(options?)`
- `options.filename?: string` (defaults to `:memory:`)
- `close(): Promise<void>` to cleanly close the SQLite connection

## Example

See `examples/basic.ts` for a minimal end-to-end usage snippet.
