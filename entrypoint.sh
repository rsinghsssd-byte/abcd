#!/bin/sh
set -e

echo ">>> entrypoint.sh starting <<<"
echo "DATABASE_URL host = $(echo $DATABASE_URL | sed -E 's|.*://[^:]+:[^@]+@([^:/]+).*|\1|')"

echo "Running database migration..."
node --enable-source-maps ./artifacts/api-server/dist/migrate.mjs

echo "Starting server..."
exec node --enable-source-maps ./artifacts/api-server/dist/index.mjs
