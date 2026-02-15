#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma

echo "Starting API server..."
exec node dist/apps/api/src/main
