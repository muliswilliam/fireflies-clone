#!/bin/sh
set -eu

echo "Applying database migrations"
node migrate.cjs

echo "Seeding Sample Meetings"
node seed.cjs

echo "Starting Firefly Notes on port ${PORT:-3000}"
exec node server.js
