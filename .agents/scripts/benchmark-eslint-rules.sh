#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repository_root}"

TIMING=all "${repository_root}/node_modules/.bin/eslint" --no-cache "$@"
