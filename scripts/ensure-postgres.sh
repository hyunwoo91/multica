#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create .env from .env.example, or run 'make worktree-env' and use .env.worktree."
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

POSTGRES_DB="${POSTGRES_DB:-multica}"
POSTGRES_USER="${POSTGRES_USER:-multica}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-multica}"

export PGPASSWORD="$POSTGRES_PASSWORD"

POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# If PostgreSQL is already reachable, skip docker compose entirely.
# This prevents recreating the shared container from worktrees or agent environments.
if pg_isready -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -q 2>/dev/null; then
  echo "==> PostgreSQL already reachable on localhost:$POSTGRES_PORT"
else
  echo "==> Starting PostgreSQL container on localhost:$POSTGRES_PORT..."
  docker compose up -d postgres

  echo "==> Waiting for PostgreSQL to be ready..."
  until pg_isready -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -q 2>/dev/null; do
    sleep 1
  done
fi

echo "==> Ensuring database '$POSTGRES_DB' exists..."
db_exists="$(psql -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -Atqc \
  "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'" 2>/dev/null)"

if [ "$db_exists" != "1" ]; then
  psql -h localhost -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"$POSTGRES_DB\"" \
    > /dev/null
fi

echo "✓ PostgreSQL ready. Application database: $POSTGRES_DB"
