#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI is required. Install it with: npm i -g vercel" >&2
  exit 1
fi

deploy_with_vercel() {
  local dir="$1"
  local output
  output="$(cd "$ROOT_DIR/$dir" && vercel --prod 2>&1)"
  printf '%s\n' "$output" >&2

  local url
  url="$(printf '%s\n' "$output" | sed -nE 's/.*Production:[[:space:]]*(https:\/\/[^[:space:]]+).*/\1/p' | tail -n 1)"

  if [[ -z "$url" ]]; then
    url="$(printf '%s\n' "$output" | grep -Eo 'https://[^[:space:]]+' | grep -v '/_logs' | tail -n 1)"
  fi

  if [[ -z "$url" ]]; then
    echo "Could not detect deployed URL for $dir from Vercel output." >&2
    exit 1
  fi

  printf '%s' "$url"
}

echo "Deploying Hello Agent PWA..." >&2
PWA_URL="$(deploy_with_vercel pwa)"

echo "Deploying Hello Agent server..." >&2
SERVER_URL="$(deploy_with_vercel server)"

cat <<JSON
{
  "name": "Hello Agent",
  "kind": "agent",
  "url": "$PWA_URL",
  "agentServerUrl": "$SERVER_URL",
  "permissions": ["user:getDetails", "user:getProfile"],
  "permissionDisclaimer": "Hello Agent reads your profile to greet you on a weekly cron."
}
JSON
