#!/bin/bash
set -euo pipefail

IMAGE=taico-worker:local
PORT=1234
CONTAINER_NAME=taico-worker
TAICO_HOME=${TAICO_HOME:-$HOME/.taico}

mkdir -p \
  "$TAICO_HOME" \
  "$HOME/.config/gh" \
  "$HOME/.config/github-copilot" \
  "$HOME/.config/opencode" \
  "$HOME/.claude" \
  "$HOME/.local/share/opencode" \
  "$HOME/.ssh"
touch "$HOME/.gitconfig"

# Mount host credentials read/write so worker OAuth, provider logins, gh, and git auth survive restarts.
# Review these mounts before using on a shared machine.
docker run --name "$CONTAINER_NAME" --restart unless-stopped -d \
  --user "$(id -u):$(id -g)" \
  -e TAICO_SERVER_URL="http://host.docker.internal:$PORT" \
  -e HOME=/home/taico \
  -e GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-}" \
  -e GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-}" \
  -e GOOGLE_GENAI_USE_VERTEXAI="${GOOGLE_GENAI_USE_VERTEXAI:-True}" \
  --add-host=host.docker.internal:host-gateway \
  -v "$TAICO_HOME:/home/taico/.taico" \
  -v "$HOME/.config/gh:/home/taico/.config/gh" \
  -v "$HOME/.config/github-copilot:/home/taico/.config/github-copilot" \
  -v "$HOME/.gitconfig:/home/taico/.gitconfig:ro" \
  -v "$HOME/.ssh:/home/taico/.ssh:ro" \
  -v "$HOME/.config/opencode:/home/taico/.config/opencode" \
  -v "$HOME/.local/share/opencode:/home/taico/.local/share/opencode" \
  -v "$HOME/.claude:/home/taico/.claude" \
  "$IMAGE"

echo "Worker started in Docker as $CONTAINER_NAME. Follow logs with: docker logs -f $CONTAINER_NAME"
