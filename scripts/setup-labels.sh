#!/usr/bin/env bash
# Canonical Forge label vocabulary. Idempotent: skips labels that already
# exist, unless --force (which enforces canonical colors/descriptions).
# Usage: bash scripts/setup-labels.sh [--repo owner/repo] [--force]
# Fetch upstream (mirrors sync-forge.sh): gh api
#   "repos/${FORGE_REPO:-benalloway/forge}/contents/scripts/setup-labels.sh?ref=${REF}" \
#   --jq .content | base64 -d > scripts/setup-labels.sh
set -euo pipefail

REPO=""
FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --repo=*) REPO="${1#*=}" ;;
    --repo) REPO="${2:?--repo needs a value}"; shift ;;
    --force) FORCE=1 ;;
    *) echo "unknown arg: $1 (want --repo owner/repo, --force)" >&2; exit 1 ;;
  esac
  shift
done
REPO_ARGS=()
[ -n "$REPO" ] && REPO_ARGS=(--repo "$REPO")

# name|color|description — the canonical Forge vocabulary. Triage roles,
# backlog label, and routing labels (triage decides WHETHER, routing WHERE).
SPECS=(
  "Forge|F9A825|Issues for Forge to work on"
  "needs-triage|FBCA04|Needs triage before planning"
  "needs-info|FEF2C0|Blocked on a question for the owner"
  "ready-for-agent|0E8A16|Fully specified, ready for an AFK agent"
  "ready-for-human|5319E7|Requires human implementation"
  "wontfix|E4E669|Decided not to do"
  "bug|D73A4A|Something is broken"
  "enhancement|A2EEEF|New feature or improvement"
  "run:home|1D76DB|Route to home-server agent; cloud Forge skips these"
  "run:cloud|0E8A16|Route to GitHub Actions cloud Forge (default when absent)"
)

EXISTING="$(gh label list "${REPO_ARGS[@]}" --limit 100 --json name --jq '.[].name')"
for spec in "${SPECS[@]}"; do
  name="${spec%%|*}"; rest="${spec#*|}"; color="${rest%%|*}"; desc="${rest#*|}"
  if echo "$EXISTING" | grep -Fxq "$name"; then
    if [ "$FORCE" -eq 1 ]; then
      gh label edit "$name" "${REPO_ARGS[@]}" --color "$color" --description "$desc"
      echo "enforced: $name"
    else
      echo "exists: $name"
    fi
  else
    gh label create "$name" "${REPO_ARGS[@]}" --color "$color" --description "$desc"
    echo "created: $name"
  fi
done
