#!/bin/bash

IMAGE=ghcr.io/galarzafrancisco/ai-monorepo:0.3.5

PORT=9999                    # Port where the server will be accessible
CONTAINER_NAME=taico         # Name for the Docker container
DATABASE_URL=${DATABASE_URL:-postgresql://taico:taico@host.docker.internal:5432/taico}

docker run --name $CONTAINER_NAME --restart unless-stopped -d \
  -p $PORT:$PORT \
  --add-host=host.docker.internal:host-gateway \
  -e NODE_ENV=production \
  -e PORT=$PORT \
  -e ISSUER_URL=http://localhost:$PORT \
  -e SECRETS_ENABLED="true" \
  -e ALLOW_PLAINTEXT_SECRETS_INSECURE="true" \
  -e DATABASE_URL="$DATABASE_URL" \
  $IMAGE

echo "Server started on port $PORT. Access it at http://localhost:$PORT"
