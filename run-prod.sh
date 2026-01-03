#!/bin/bash

# This script simulates running a production server.

# Build
# npm run zero-to-prod

# Start backend
export NODE_ENV=production
export DATABASE_PATH=./foo.sqlite
export BACKEND_PORT=5432 # Where the backend listens
export ISSUER_URL=http://localhost:5432 # Used by the backend to set iss in tokens. Also served so the frontends can discover it.
export ADK_URL=http://air.local:8000
export OLLAMA_URL=http://air.local:11434
npm run start
