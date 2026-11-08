#!/usr/bin/env bash
set -euo pipefail

: "${EMAIL_ISLAND_TEST_RUNTIME:?Set an isolated test runtime directory}"
: "${EMAIL_ISLAND_REDIS_BINARY:?Set the Redis 8.10.3 server executable}"
: "${EMAIL_ISLAND_REDIS_URL:?Set the isolated Redis URL with an explicit port}"
: "${EMAIL_ISLAND_REDIS_DATA:?Set the isolated Redis data directory}"
: "${TYPESAFE_BASE_URL:?Set the local Jev fixture URL with an explicit port}"

test_node_version=$(node -p 'process.versions.node')
[[ "$test_node_version" == "$(cat .node-version)" ]] || { echo "Use the Node version in .node-version" >&2; exit 1; }
"$EMAIL_ISLAND_REDIS_BINARY" --version | grep -F 'v=8.10.3' >/dev/null
mkdir -p "$EMAIL_ISLAND_TEST_RUNTIME" "$EMAIL_ISLAND_REDIS_DATA"
node --input-type=module <<'JS'
import {createServer} from 'node:net';
for (const url of [process.env.EMAIL_ISLAND_REDIS_URL,process.env.TYPESAFE_BASE_URL]) {
  const server=createServer();
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(Number(new URL(url).port),'127.0.0.1',()=>server.close(resolve));
  });
}
JS
test_redis_port=$(node -p 'new URL(process.env.EMAIL_ISLAND_REDIS_URL).port')
test_redis_cli="${EMAIL_ISLAND_REDIS_BINARY%redis-server}redis-cli"
"$EMAIL_ISLAND_REDIS_BINARY" --bind 127.0.0.1 --port "$test_redis_port" \
  --appendonly yes --appendfsync everysec --maxmemory-policy noeviction \
  --dir "$EMAIL_ISLAND_REDIS_DATA" --daemonize yes \
  --pidfile "$EMAIL_ISLAND_REDIS_DATA/redis.pid" --logfile "$EMAIL_ISLAND_REDIS_DATA/redis.log"

node --input-type=module <<'JS'
import {spawn} from 'node:child_process';
import {openSync,closeSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const runtime=process.env.EMAIL_ISLAND_TEST_RUNTIME;
const log=openSync(join(runtime,'provider.log'),'w',0o600);
const provider=spawn(process.execPath,['--import','tsx','src/features/classifier/jev-fixture.server.ts'],{
  cwd:process.cwd(),detached:true,stdio:['ignore',log,log],
  env:{...process.env,EMAIL_ISLAND_JEV_FIXTURE_PORT:new URL(process.env.TYPESAFE_BASE_URL).port},
});
provider.unref();closeSync(log);
writeFileSync(join(runtime,'provider.pid'),String(provider.pid));
JS

for test_attempt in {1..80}; do
  if kill -0 "$(cat "$EMAIL_ISLAND_TEST_RUNTIME/provider.pid")" 2>/dev/null && \
      grep -F "Jev fixture ready" "$EMAIL_ISLAND_TEST_RUNTIME/provider.log" >/dev/null && \
      "$test_redis_cli" -p "$test_redis_port" ping >/dev/null 2>&1 && \
      curl --fail --silent --output /dev/null "$TYPESAFE_BASE_URL/calls"; then
    echo "Redis 8.10.3 and Jev HTTP fixture ready"
    exit 0
  fi
  sleep 0.25
done
echo "Test services did not become ready; inspect the isolated service logs" >&2
exit 1
