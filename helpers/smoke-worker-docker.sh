#!/bin/bash
set -euo pipefail

IMAGE=${IMAGE:-taico-worker:local}
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

mkdir -p \
  "$tmpdir/docker-home" \
  "$tmpdir/docker-home/.cache" \
  "$tmpdir/docker-home/.config" \
  "$tmpdir/docker-home/.local/share" \
  "$tmpdir/docker-home/.local/state" \
  "$tmpdir/taico" \
  "$tmpdir/gh" \
  "$tmpdir/copilot" \
  "$tmpdir/opencode-config" \
  "$tmpdir/opencode-share" \
  "$tmpdir/claude" \
  "$tmpdir/ssh"
touch "$tmpdir/gitconfig"

docker run --rm --entrypoint bash \
  --user "$(id -u):$(id -g)" \
  -e HOME=/home/taico \
  -v "$tmpdir/docker-home:/home/taico" \
  -v "$tmpdir/taico:/home/taico/.taico" \
  -v "$tmpdir/gh:/home/taico/.config/gh" \
  -v "$tmpdir/copilot:/home/taico/.config/github-copilot" \
  -v "$tmpdir/gitconfig:/home/taico/.gitconfig:ro" \
  -v "$tmpdir/ssh:/home/taico/.ssh:ro" \
  -v "$tmpdir/opencode-config:/home/taico/.config/opencode" \
  -v "$tmpdir/opencode-share:/home/taico/.local/share/opencode" \
  -v "$tmpdir/claude:/home/taico/.claude" \
  "$IMAGE" \
  -lc 'set -euo pipefail
    node --version
    npm --version
    python --version
    git --version
    gh --version
    opencode --version
    claude --version
    copilot_bin=$(command -v copilot || command -v github-copilot)
    "$copilot_bin" --version
    test -w /home/taico
    test -d /home/taico/.cache
    test -d /home/taico/.local/state
  '

echo "Docker worker smoke check passed for $IMAGE"
