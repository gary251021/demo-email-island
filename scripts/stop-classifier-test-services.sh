#!/usr/bin/env bash
set -euo pipefail

: "${EMAIL_ISLAND_TEST_RUNTIME:?Set the test runtime directory used at startup}"
: "${EMAIL_ISLAND_REDIS_BINARY:?Set the Redis server executable used at startup}"
: "${EMAIL_ISLAND_REDIS_URL:?Set the isolated Redis URL used at startup}"
: "${EMAIL_ISLAND_REDIS_DATA:?Set the Redis data directory used at startup}"

if [[ -f "$EMAIL_ISLAND_TEST_RUNTIME/provider.pid" ]]; then
  kill "$(cat "$EMAIL_ISLAND_TEST_RUNTIME/provider.pid")" 2>/dev/null || true
  rm "$EMAIL_ISLAND_TEST_RUNTIME/provider.pid"
fi
test_redis_port=$(node -p 'new URL(process.env.EMAIL_ISLAND_REDIS_URL).port')
test_redis_cli="${EMAIL_ISLAND_REDIS_BINARY%redis-server}redis-cli"
if [[ -f "$EMAIL_ISLAND_REDIS_DATA/redis.pid" ]] && command -v "$test_redis_cli" >/dev/null 2>&1; then
  "$test_redis_cli" -p "$test_redis_port" shutdown >/dev/null 2>&1 || true
fi
