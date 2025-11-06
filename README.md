# AI Monorepo

Monorepo to learn and experiment with application development.

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

To run multiple development stacks simultaneously (useful for testing or comparing branches), configure different ports using environment variables:

**Stack 1 (default ports):**
```bash
npm run dev
# Backend: http://localhost:3000
# Frontend: http://localhost:5173
```

**Stack 2 (custom ports):**
```bash
PORT=3001 VITE_PORT=5174 npm run dev
# Backend: http://localhost:3001
# Frontend: http://localhost:5174
```

You can also create `.env` files for each stack:
```bash
# .env.stack1
PORT=3000
VITE_PORT=5173

# .env.stack2
PORT=3001
VITE_PORT=5174
```

### Production Mode (Docker)
```bash
# Run on default port (3000)
./run-docker.sh

# Run on custom port
./run-docker.sh 3001
```

See [DOCKER.md](DOCKER.md) for detailed Docker deployment instructions.

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

