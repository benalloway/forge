#!/usr/bin/env bash
# Vendor the Forge runner into a consumer repo.
# Mirrors the @benalloway/ui `ui:sync` pattern: version-pinned copy, no registry.
#
# Usage: [FORGE_REPO=owner/repo] bash scripts/sync-forge.sh [ref]
#   ref defaults to the pin in scripts/forge-version.txt, else "v1".
#   FORGE_REPO defaults to "benalloway/forge" — forks set it to their own repo
#   and everything (vendor + installer) follows.
set -euo pipefail

FORGE_REPO="${FORGE_REPO:-benalloway/forge}"
PIN_FILE="scripts/forge-version.txt"
REF="${1:-}"
if [ -z "$REF" ] && [ -f "$PIN_FILE" ]; then
  REF="$(cat "$PIN_FILE")"
fi
REF="${REF:-v1}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching ${FORGE_REPO}@${REF} ..."
gh api "repos/${FORGE_REPO}/tarball/${REF}" > "$TMP/forge.tar.gz"
tar -xzf "$TMP/forge.tar.gz" -C "$TMP"
# Tarball root naming varies (repo-ref); locate the runner by directory name.
SRC="$(find "$TMP" -maxdepth 2 -type d -name runner | head -n 1)"
if [ -z "$SRC" ]; then
  echo "error: no runner/ dir found in ${FORGE_REPO}@${REF}" >&2
  exit 1
fi

rm -rf .forge
mkdir -p .forge
cp -r "$SRC"/. .forge/
echo "$REF" > "$PIN_FILE"
echo "Vendored Forge ${REF} into .forge/ (pin: ${PIN_FILE})"
