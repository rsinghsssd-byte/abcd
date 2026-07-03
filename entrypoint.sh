#!/bin/sh
set -e

echo "Running database migration..."
node scripts/migrate.mjs

echo "Starting server..."
exec node --enable-source-maps ./artifacts/api-server/dist/index.mjs
