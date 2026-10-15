#!/usr/bin/env bash
# Vendor the Forge runner into a consumer repo.
# Mirrors the @benalloway/ui `ui:sync` pattern: version-pinned copy, no registry.
#
# Usage: bash scripts/sync-forge.sh [ref]
#   ref defaults to the pin in scripts/forge-version.txt, else "v1".
set -euo pipefail

PIN_FILE="scripts/forge-version.txt"
REF="${1:-}"
if [ -z "$REF" ] && [ -f "$PIN_FILE" ]; then
  REF="$(cat "$PIN_FILE")"
fi
REF="${REF:-v1}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching benalloway/forge@${REF} ..."
gh api "repos/benalloway/forge/tarball/${REF}" > "$TMP/forge.tar.gz"
tar -xzf "$TMP/forge.tar.gz" -C "$TMP"
SRC="$TMP"/benalloway-forge-*/runner

rm -rf .forge
mkdir -p .forge
cp -r "$SRC"/. .forge/
echo "$REF" > "$PIN_FILE"
echo "Vendored Forge ${REF} into .forge/ (pin: ${PIN_FILE})"
