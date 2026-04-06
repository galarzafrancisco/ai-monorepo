# Packages

Public npm packages under the `@taico` scope.

| Package | Description | npm |
|---|---|---|
| `@taico/client` | Auto-generated API client and TypeScript types from the backend OpenAPI spec | [npm](https://www.npmjs.com/package/@taico/client) |
| `@taico/events` | Shared event type definitions for WebSocket communication | [npm](https://www.npmjs.com/package/@taico/events) |
| `@taico/errors` | Shared error classes and error codes | [npm](https://www.npmjs.com/package/@taico/errors) |
| `@taico/adk-session-store` | SQLite-backed Google ADK session service compatible with `BaseSessionService` | [npm](https://www.npmjs.com/package/@taico/adk-session-store) |
| `@taico/taico` | Taico backend server (NestJS + bundled UIs) | [npm](https://www.npmjs.com/package/@taico/taico) |

## Prerequisites

You must be logged into npm with access to the `@taico` scope:

```bash
npm login
```

## Scripts

Each package has two convenience scripts:

- **`npm run pack`** — Build and create a `.tgz` tarball for local testing.
- **`npm run release`** — Build and publish to npm with public access.

### Local Testing

To test a package in another project before publishing:

```bash
# Create a tarball
npm -w packages/events run pack

# Install it in your other project
cd /path/to/other/project
npm install /path/to/taico-events-0.0.2.tgz
```

### Publishing

Bump the version in `package.json`, then:

```bash
npm -w packages/events run release
npm -w packages/errors run release
npm -w packages/adk-session-store run release
npm -w packages/client run release
npm -w apps/backend run release
```

Note: `@taico/client` uses `build:prod` which runs the full OpenAPI codegen pipeline. This requires the backend to have been built first (`npm run zero-to-prod`).

### `@taico/taico` (backend)

The backend package includes the compiled NestJS server and both UI builds (`dist/public/` and `dist/public/beta/`). Because `nest build` deletes `dist/` before compiling, the `pack` and `release` scripts **do not** rebuild — they assume `dist/` is already fully populated.

Always pack/release from the repo root after a full build:

```bash
# 1. Full build (compiles backend + UIs, copies assets into dist/)
npm run zero-to-prod

# 2. Pack or release
npm -w apps/backend run pack
npm -w apps/backend run release
```

Do **not** run `npm run build` in the backend workspace before packing — it will wipe the UI assets from `dist/`.
