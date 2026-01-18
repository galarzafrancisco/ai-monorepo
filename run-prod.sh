#!/bin/bash

# This script simulates running a production server.

# Build
# npm run zero-to-prod

# Start backend
export NODE_ENV=production
export DATABASE_PATH="./data/database.sqlite"
export BACKEND_PORT=3000 # Where the backend listens
export ISSUER_URL=http://localhost:3000 # Used by the backend to set iss in tokens. Also served so the frontends can discover it.
export ADK_URL=http://air.local:8000
export OLLAMA_URL=http://air.local:11434
npm run start
