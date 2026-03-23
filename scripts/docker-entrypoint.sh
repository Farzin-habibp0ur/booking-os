#!/bin/sh
set -e

echo "Running database migrations..."
if timeout 120 npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma; then
  echo "Migrations completed successfully."
else
  EXIT_CODE=$?
  if [ "$EXIT_CODE" -eq 124 ]; then
    echo "ERROR: Database migration timed out after 120 seconds"
  else
    echo "ERROR: Database migration failed with exit code $EXIT_CODE"
  fi
  exit 1
fi

echo "Starting API server..."
exec node dist/apps/api/src/main
