#!/bin/bash
set -euo pipefail

if [[ -n "${MONGODB_KEYFILE_CONTENT:-}" ]]; then
  printf '%s' "${MONGODB_KEYFILE_CONTENT}" > /tmp/mongodb-keyfile
elif [[ -f /scripts/mongodb-keyfile ]]; then
  cp /scripts/mongodb-keyfile /tmp/mongodb-keyfile
else
  echo "MongoDB keyfile is missing. Set MONGODB_KEYFILE_CONTENT or mount /scripts/mongodb-keyfile." >&2
  exit 1
fi

chmod 400 /tmp/mongodb-keyfile
chown mongodb:mongodb /tmp/mongodb-keyfile 2>/dev/null || true

exec /usr/local/bin/docker-entrypoint.sh mongod --replSet rs0 --bind_ip_all --keyFile /tmp/mongodb-keyfile
