# @taico/adk-session-store

[![Socket Badge](https://badge.socket.dev/npm/package/@taico/adk-session-store/0.3.4)](https://badge.socket.dev/npm/package/@taico/adk-session-store/0.3.4)

SQLite-backed session storage for Google ADK.

`SqliteSessionService` extends ADK `BaseSessionService` and is intended as a drop-in replacement for `InMemorySessionService` when you need persistence.

## Installation

```bash
npm install @taico/adk-session-store
```

## Usage

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

- `new SqliteSessionService(options?)`
- `options.filename?: string` (defaults to `:memory:`)
- `close(): Promise<void>` to cleanly close the SQLite connection

## Example

See `examples/basic.ts` for a minimal end-to-end usage snippet.
