#!/bin/bash

# Script to run the AI Monorepo with Docker
# Usage: ./run-docker.sh [port]
# Example: ./run-docker.sh 3001

# Default port is 3000
PORT=${1:-3000}

# Create data directory if it doesn't exist
mkdir -p data

echo "Starting AI Monorepo on port $PORT..."
echo "The database will be persisted in the ./data directory"

# Export the port and run docker-compose
HOST_PORT=$PORT docker-compose up -d

echo ""
echo "Application started successfully!"
echo "Access it at: http://localhost:$PORT"
echo "API docs at: http://localhost:$PORT/api/v1/docs"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
