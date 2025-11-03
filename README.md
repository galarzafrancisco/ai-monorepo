# AI Monorepo

Monorepo to learn and experiment with application development.

## Overview

This repository is a sandbox for learning and experimenting with application development. It is structured as a monorepo with a 2-layer architecture (Backend → UI) and includes shared packages for types and utilities. The goal is to explore best practices, patterns, and techniques for building applications.

## API Spec Generation Workflow

The project uses OpenAPI to generate TypeScript types and API clients automatically:

1. Generate the OpenAPI spec from the backend:
   ```bash
   npm -w apps/backend run generate:spec
   ```
   This builds the backend and generates `apps/backend/contracts/openapi.json` without starting the server.

2. Copy the spec to the shared package:
   ```bash
   cp apps/backend/contracts/openapi.json shared/contracts/openapi.json
   ```

3. Generate TypeScript types from the spec:
   ```bash
   npm -w shared run generate:types
   ```

4. Generate the API client:
   ```bash
   npm -w shared run generate:client
   ```

## Documentation

For detailed information about the project, refer to the following documents:

- [Goals](docs/GOAL.md): Understand the objectives and learning outcomes of this project.
- [Requirements](docs/REQUIREMENTS.md): Explore the functional and technical requirements of the vet booking system.
- [Artefacts](docs/ARTEFACTS.md): Learn about the artefacts created to ensure quality and consistency.

