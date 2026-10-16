#!/usr/bin/env bash
# Dev stack 1 (UI on :2000) with Sign in with ChatGPT turned on.
#
# Sign in with ChatGPT refuses plaintext secret storage, so this runs with
# SECRETS_ENCRYPTION_KEY instead of stack1.env's ALLOW_PLAINTEXT_SECRETS_INSECURE.
# It uses its own database (taico_chatgpt) because secrets stored in plaintext
# in taico_1 cannot be read once encryption is on.
#
# The key is generated on first run and kept in .env.chatgpt-dev (gitignored).
# Keep that file: losing the key makes the stored ChatGPT tokens unreadable.
set -euo pipefail

cd "$(dirname "$0")/.."

KEY_FILE=.env.chatgpt-dev
DB_NAME=taico_chatgpt

if [ ! -f "$KEY_FILE" ]; then
  echo "Generating $KEY_FILE with a new SECRETS_ENCRYPTION_KEY"
  umask 077
  echo "SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)" > "$KEY_FILE"
fi

# Create the database in the compose Postgres if it does not exist yet.
if ! docker compose exec -T postgres psql -U taico -d taico -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
  echo "Creating database $DB_NAME"
  docker compose exec -T postgres psql -U taico -d taico -c "CREATE DATABASE $DB_NAME"
fi

# Values already in the environment win over the env files, so these override stack1.env.
set -a
# shellcheck disable=SC1090
. "./$KEY_FILE"
set +a
export SECRETS_ENABLED=true
export ALLOW_PLAINTEXT_SECRETS_INSECURE=false
export CHATGPT_SUBSCRIPTION_ENABLED=true
export DATABASE_URL="postgresql://taico:taico@localhost:5432/$DB_NAME"

exec npx dotenv -e stack1.env -- concurrently -n backend,ui-v1,ui -c auto \
  "npm -w apps/backend run dev" "npm -w apps/ui-v1 run dev" "npm -w apps/ui run dev"
