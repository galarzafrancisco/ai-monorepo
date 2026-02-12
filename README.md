# taico

Monorepo to learn and experiment with application development.
Build timing check: README update.

## Overview

This repository is a sandbox for learning and experimenting with application development. It is structured as a monorepo with a 2-layer architecture (Backend → UI) and includes shared packages for types and utilities. The goal is to explore best practices, patterns, and techniques for building applications.

## Quick Start

### Zero to Hero (Production Build)
```bash
# One command to go from zero to production-ready build
# Installs dependencies, generates API clients, and builds all apps in the correct order
npm run zero-to-prod
```

### Development Mode
```bash
# Install dependencies
npm install

# Start both backend and frontend with hot reload
npm run dev
```

#### Running Multiple Stacks in Parallel

To run multiple development stacks simultaneously (useful for testing or comparing branches), use the pre-configured `npm run dev:[1-5]` scripts. Each stack has its own env file (`stack[1-5].env`) with isolated ports and a separate SQLite database, so there are no collisions.

```bash
npm run dev:1   # Stack 1 — UI :2000, Legacy UI :2001, Backend :2003, DB: database-1.sqlite
npm run dev:2   # Stack 2 — UI :2004, Legacy UI :2005, Backend :2006, DB: database-2.sqlite
npm run dev:3   # Stack 3 — UI :2008, Legacy UI :2009, Backend :2010, DB: database-3.sqlite
npm run dev:4   # Stack 4 — see stack4.env
npm run dev:5   # Stack 5 — see stack5.env
```

Each script loads the corresponding `stack[N].env` via `dotenv-cli` before starting the dev servers. You can customise ports, database path, and other settings by editing the env file directly.

## API Spec Generation

The project uses OpenAPI to generate TypeScript types and API clients automatically. This happens automatically during the production build process (`npm run build:prod` or `npm run zero-to-prod`), which:

1. Builds the backend and generates the OpenAPI spec
2. Copies the spec to the shared package
3. Generates TypeScript types and API client from the spec
4. Builds all packages in the correct order

No manual intervention is required - the entire workflow is automated.

## Documentation

For detailed information about the project, refer to the following documents:

- [Goals](docs/GOAL.md): Understand the objectives and learning outcomes of this project.
- [Requirements](docs/REQUIREMENTS.md): Explore the functional and technical requirements of the vet booking system.
- [Artefacts](docs/ARTEFACTS.md): Learn about the artefacts created to ensure quality and consistency.
