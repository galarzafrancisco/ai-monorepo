#!/bin/bash

IMAGE=ghcr.io/galarzafrancisco/ai-monorepo:0.2.17

PORT=9999                    # Port where the server will be accessible
CONTAINER_NAME=taico         # Name for the Docker container
DATABASE_PATH=$(pwd)/data    # Path to the local directory for database storage

docker run --name $CONTAINER_NAME --restart unless-stopped -d \
  -p $PORT:$PORT \
  -e NODE_ENV=production \
  -e PORT=$PORT \
  -e ISSUER_URL=http://localhost:$PORT \
  -e SECRETS_ENABLED="true" \
  -e ALLOW_PLAINTEXT_SECRETS_INSECURE="true" \
  -e DATABASE_PATH=/app/data/database.sqlite \
  -v $DATABASE_PATH:/app/data \
  $IMAGE

echo "Server started on port $PORT. Access it at http://localhost:$PORT"
