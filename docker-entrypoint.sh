#!/bin/sh
set -eu

echo "Applying database migrations"
node migrate.cjs

echo "Starting Firefly Notes on port ${PORT:-3000}"
exec node server.js
