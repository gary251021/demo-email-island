#!/usr/bin/env bash
set -u

if ! node .agents/scripts/checkAgentsMdSize.mjs; then
  echo "Harness stopped at the AGENTS.md instruction-budget check; fix the values above and rerun npm run harness-signal." >&2
  exit 1
fi

eslint --cache --cache-location node_modules/.cache/eslint/
eslint_status=$?

npm run lint:deps
deps_status=$?

# TODO: add back knip check for dangling deps
# npm run knip
# knip_status=$?

if [[ "$eslint_status" -ne 0 || "$deps_status" -ne 0 ]]; then
  exit 1
fi
