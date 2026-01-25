# Taico CLI

CLI tool to run taico server and worker.

## Installation

```bash
npm install -g taico
```

Or use with npx:

```bash
npx taico
```

## Usage

### Run both server and worker

```bash
npx taico
```

### Run server only

```bash
npx taico server
```

This runs the backend server (which also serves the UI2 frontend).

### Run worker only

```bash
npx taico worker
```

By default, the worker connects to `http://localhost:3000`. You can specify a custom server URL:

```bash
npx taico worker --server-url http://your-server:3000
```

## Development

Build the CLI:

```bash
npm run build
```

## How it works

- **Server**: Runs `apps/backend` which serves the compiled UI from `apps/ui2`
- **Worker**: Runs `apps/agents` which is the worker/agent process
- The CLI uses the built applications from the monorepo
