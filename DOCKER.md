# Docker Deployment Guide

This guide explains how to package and run the AI Monorepo as a single Docker container.

## Overview

The Docker setup packages both the frontend and backend into a single container:
- Frontend is built as static files and served by the backend
- Backend serves API endpoints under `/api/v1` prefix
- API documentation available at `/api/v1/docs`
- SQLite database is persisted in a mounted volume

## Quick Start

### Option 1: Using the convenience script

Run on default port (3000):
```bash
./run-docker.sh
```

Run on a custom port (e.g., 3001):
```bash
./run-docker.sh 3001
```

### Option 2: Using npm scripts

```bash
# Build the Docker image
npm run docker:build

# Start the container
npm run docker:up

# View logs
npm run docker:logs

# Stop the container
npm run docker:down

# Rebuild and restart
npm run docker:rebuild
```

### Option 3: Using docker-compose directly

```bash
# Start on default port (3000)
docker-compose up -d

# Start on custom port (e.g., 3001)
HOST_PORT=3001 docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Running Multiple Instances

You can run multiple instances on different ports simultaneously. Each instance will have its own database:

```bash
# Instance 1 on port 3000 (stable version)
HOST_PORT=3000 docker-compose up -d

# Instance 2 on port 3001 (development version)
HOST_PORT=3001 docker-compose up -d
```

To use separate docker-compose files for multiple instances:

```bash
# Create a custom docker-compose file
cp docker-compose.yml docker-compose.dev.yml

# Edit docker-compose.dev.yml to use different container name and volume

# Run both instances
docker-compose up -d
docker-compose -f docker-compose.dev.yml up -d
```

## Persistent Data

The SQLite database is stored in the `./data` directory, which is mounted as a volume in the container. This ensures your data persists across container restarts.

To backup your database:
```bash
cp data/database.sqlite data/database.sqlite.backup
```

To reset your database:
```bash
docker-compose down
rm data/database.sqlite
docker-compose up -d
```

## Accessing the Application

Once running, you can access:
- **Web UI**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/v1/docs
- **API Endpoints**: http://localhost:3000/api/v1/*

(Replace 3000 with your custom port if different)

## Architecture

### Build Process

The Dockerfile uses a multi-stage build:

1. **Builder stage**:
   - Installs all dependencies
   - Generates shared types and API client
   - Builds backend (TypeScript → JavaScript)
   - Builds frontend (React → static files in `backend/dist/public`)

2. **Production stage**:
   - Installs only production dependencies
   - Copies built files from builder stage
   - Runs the backend server which serves both API and static files

### API Routing

- All API routes are prefixed with `/api/v1`
- Static frontend files are served from the root
- The backend automatically falls back to serving `index.html` for client-side routing

### Environment Variables

You can customize the behavior with environment variables:

- `HOST_PORT`: The port on your host machine (default: 3000)
- `PORT`: The port inside the container (default: 3000)
- `DATABASE_PATH`: Path to SQLite database (default: data/database.sqlite)
- `NODE_ENV`: Node environment (set to production in Docker)

To set custom environment variables, edit the `docker-compose.yml` file or pass them when running:

```bash
HOST_PORT=3001 DATABASE_PATH=/app/data/custom.sqlite docker-compose up -d
```

## Development vs Production

During development:
- Run `npm run dev` to start both backend and frontend with hot reload
- Frontend runs on port 5173, backend on port 3000
- API calls use absolute URLs to `http://localhost:3000/api/v1`

In production (Docker):
- Single process serves everything on one port
- Frontend uses relative URLs to `/api/v1`
- Static files are pre-built and optimized

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Rebuild the image
npm run docker:rebuild
```

### Port already in use
```bash
# Use a different port
HOST_PORT=3001 docker-compose up -d
```

### Database issues
```bash
# Reset the database
docker-compose down
rm -rf data
mkdir data
docker-compose up -d
```

### Changes not appearing
```bash
# Rebuild the image after code changes
npm run docker:rebuild
```

## Updating the Application

After making code changes:

1. Stop the running container:
   ```bash
   npm run docker:down
   ```

2. Rebuild the image:
   ```bash
   npm run docker:build
   ```

3. Start the updated container:
   ```bash
   npm run docker:up
   ```

Or use the convenient rebuild command:
```bash
npm run docker:rebuild
```
