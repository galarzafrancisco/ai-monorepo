# Backend

NestJS backend for Taico.

This app owns:

- tasks, threads, context, agents, and projects
- authentication and authorization
- execution queue and active execution lifecycle
- realtime APIs and MCP surfaces

## Local Development

From the monorepo root:

```bash
npm run build:dev
npm run dev:1
```

Or run the backend package directly:

```bash
npm -w apps/backend run start:dev
```

## Tests

From the monorepo root:

```bash
npm run test:e2e
npm run test:e2e:worker-auth
```

Or package-local:

```bash
npm -w apps/backend run test
npm -w apps/backend run test:e2e
```

## Notes

- The runtime model is execution-centric.
- `apps/worker` is the current worker runtime.
- `apps/worker-v1` is legacy.

See the repo-level guides for broader setup and architecture:

- [`docs/PRIMITIVES.md`](/Users/franciscogalarza/github/ai-monorepo/docs/PRIMITIVES.md)
- [`docs/DEVELOPER_GUIDE.md`](/Users/franciscogalarza/github/ai-monorepo/docs/DEVELOPER_GUIDE.md)
