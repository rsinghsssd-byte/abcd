#!/bin/sh
set -e

echo "Running database migration..."
pnpm --filter db push || echo "Migration skipped or already applied"

echo "Starting server..."
exec node --enable-source-maps ./artifacts/api-server/dist/index.mjs
