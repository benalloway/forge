#!/usr/bin/env bash
# Regression test for runner/build-review-context.sh. Self-contained: builds
# a scratch repo, fakes `gh`, and runs the resolution matrix.
# Fails non-zero on the first mismatch. Run in CI and locally.
set -euo pipefail

FORGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$FORGE_DIR/runner/build-review-context.sh"
bash -n "$SCRIPT"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin" "$WORK/repo"
cd "$WORK/repo"

# Fake gh: ignores flags, prints canned PR context markdown (we test OUR
# logic, not gh's --jq rendering).
cat > "$WORK/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "## Fake PR"
echo
echo "fake-url (head → main)"
echo
echo "### Body"
echo
echo "Fake body."
EOF
chmod +x "$WORK/bin/gh"
export PATH="$WORK/bin:$PATH"

git init -q && git config user.email t@t && git config user.name t
mkdir -p .sandcastle .forge/prompts
echo "standards" > .sandcastle/CODING_STANDARDS.md
echo "prompt" > .forge/prompts/pr-review-prompt.md
echo "agents" > AGENTS.md
echo "v1" > app.txt && git add -A && git commit -qm base
echo "v2" > app.txt && git commit -qam change
BASE_SHA="$(git rev-parse HEAD~1)"
HEAD_SHA="$(git rev-parse HEAD)"

run_case() {
  local desc="$1"; shift
  rm -f .forge-review-context.md .forge-review.md
  rm -rf .forge-review
  : > "$WORK/env"
  GITHUB_ENV="$WORK/env" PR_NUMBER=1 HEAD_SHA="$HEAD_SHA" BASE_SHA="$BASE_SHA" \
    REVIEW_STANDARDS_IN=".sandcastle/CODING_STANDARDS.md" \
    REVIEW_PROMPT_IN=".forge/prompts/pr-review-prompt.md" \
    "$@" bash "$SCRIPT"
  echo "PASS: $desc"
}

# 1. Happy path: worktree paths used verbatim.
run_case "happy path"
grep -q "^REVIEW_STANDARDS=$WORK/repo/.sandcastle/CODING_STANDARDS.md$" "$WORK/env"
grep -q "^REVIEW_PROMPT=$WORK/repo/.forge/prompts/pr-review-prompt.md$" "$WORK/env"
grep -q "Fake PR" .forge-review-context.md
grep -q "app.txt" .forge-review-context.md

# 2. Sparse worktree: files gone from disk, present in HEAD → materialized.
rm -rf .sandcastle .forge
run_case "HEAD fallback"
grep -q "^REVIEW_STANDARDS=$WORK/repo/.forge-review/standards.md$" "$WORK/env"
grep -q "^REVIEW_PROMPT=$WORK/repo/.forge-review/prompt.md$" "$WORK/env"
[ "$(cat .forge-review/standards.md)" = "standards" ]
[ "$(cat .forge-review/prompt.md)" = "prompt" ]
git checkout -q HEAD -- .sandcastle .forge

# 3. Standards missing from worktree AND HEAD → AGENTS.md fallback.
git rm -q --cached -r .sandcastle && rm -rf .sandcastle
git commit -qm "drop standards"
HEAD_SHA="$(git rev-parse HEAD)"
run_case "AGENTS.md fallback"
grep -q "^REVIEW_STANDARDS=$WORK/repo/AGENTS.md$" "$WORK/env"

# 4. No standards anywhere → clean failure (absent from worktree and HEAD).
mv AGENTS.md AGENTS.bak
git rm -q --cached AGENTS.md && git commit -qm "drop agents"
HEAD_SHA="$(git rev-parse HEAD)"
if : > "$WORK/env"; GITHUB_ENV="$WORK/env" PR_NUMBER=1 HEAD_SHA="$HEAD_SHA" BASE_SHA="$BASE_SHA" \
  REVIEW_STANDARDS_IN=".sandcastle/CODING_STANDARDS.md" \
  REVIEW_PROMPT_IN=".forge/prompts/pr-review-prompt.md" \
  bash "$SCRIPT" 2>/dev/null; then
  echo "FAIL: expected non-zero exit with no standards file"; exit 1
fi
echo "PASS: missing standards fails clean"
mv AGENTS.bak AGENTS.md

# 5. Prompt missing everywhere → clean failure naming sync-forge.sh.
# (Redirect, don't pipe: with pipefail a pipe's status is the script's
# nonzero exit even when grep matches.)
git rm -q --cached .forge/prompts/pr-review-prompt.md
rm -rf .forge
git commit -qm "drop prompt" 2>/dev/null || true
HEAD_SHA="$(git rev-parse HEAD)"
if : > "$WORK/env"; GITHUB_ENV="$WORK/env" PR_NUMBER=1 HEAD_SHA="$HEAD_SHA" BASE_SHA="$BASE_SHA" \
  REVIEW_STANDARDS_IN="AGENTS.md" \
  REVIEW_PROMPT_IN=".forge/prompts/pr-review-prompt.md" \
  bash "$SCRIPT" > "$WORK/case5.out" 2>&1; then
  echo "FAIL: expected non-zero exit with missing prompt"; exit 1
fi
grep -q "sync-forge.sh" "$WORK/case5.out" || {
  echo "FAIL: missing prompt error should name sync-forge.sh"; exit 1
}
echo "PASS: missing prompt fails naming sync-forge.sh"

# 6. Missing required env → immediate failure under set -u.
if : > "$WORK/env"; GITHUB_ENV="$WORK/env" bash "$SCRIPT" 2>/dev/null; then
  echo "FAIL: expected failure with unset PR_NUMBER"; exit 1
fi
echo "PASS: unset env fails fast"

echo "ALL REVIEW-CONTEXT TESTS PASS"
