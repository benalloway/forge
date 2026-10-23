#!/usr/bin/env bash
# Build the agent's review context and resolve input files to absolute paths.
# Runs inside the consumer checkout (vendored to .forge/ via sync-forge.sh).
# Required env: PR_NUMBER, HEAD_SHA, BASE_SHA (base branch sha),
#   REVIEW_STANDARDS_IN, REVIEW_PROMPT_IN. GH_TOKEN for `gh` calls.
# Writes GITHUB_ENV entries: REVIEW_BASE/HEAD/CONTEXT/OUTPUT/STANDARDS/PROMPT.
set -euo pipefail

: "${PR_NUMBER:?PR_NUMBER not set}"
: "${HEAD_SHA:?HEAD_SHA not set}"
: "${BASE_SHA:?BASE_SHA not set}"
: "${GITHUB_ENV:?GITHUB_ENV not set}"

BASE_SHA="$(git merge-base HEAD "$BASE_SHA")"
{
  echo "# PR #${PR_NUMBER} context"
  echo
  gh pr view "$PR_NUMBER" --json title,body,baseRefName,headRefName,url \
    --jq '"## " + .title + "\n\n" + .url + " (" + .headRefName + " → " + .baseRefName + ")\n\n### Body\n\n" + (.body // "(empty)")'
  echo
  echo "### Diffstat (base $BASE_SHA → head $HEAD_SHA)"
  echo
  echo '```'
  git diff --stat "$BASE_SHA" "$HEAD_SHA"
  echo '```'
} > .forge-review-context.md

{
  echo "REVIEW_BASE=$BASE_SHA"
  echo "REVIEW_HEAD=$HEAD_SHA"
  echo "REVIEW_CONTEXT=$PWD/.forge-review-context.md"
  echo "REVIEW_OUTPUT=$PWD/.forge-review.md"
} >> "$GITHUB_ENV"

mkdir -p .forge-review

# Resolve a repo-relative file to an absolute path the agent can read:
# prefer the worktree, else materialize from HEAD (robust against
# partial/sparse checkouts), else fail with diagnostics.
resolve() {
  local rel="$1" dest="$2"
  if [ -f "$rel" ]; then
    echo "resolve: $rel <- worktree" >&2
    echo "$PWD/$rel"
  elif git cat-file -e "HEAD:$rel" 2>/dev/null; then
    echo "resolve: $rel <- HEAD (absent from worktree)" >&2
    git show "HEAD:$rel" > "$dest"
    echo "$PWD/$dest"
  else
    {
      echo "::error::$rel not in worktree nor in HEAD."
      echo "pwd=$PWD head=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
      git ls-files | head -30
    } >&2
    return 1
  fi
}

if out="$(resolve "${REVIEW_STANDARDS_IN:?}" .forge-review/standards.md)"; then
  echo "REVIEW_STANDARDS=$out" >> "$GITHUB_ENV"
else
  for fallback in AGENTS.md CONTRIBUTING.md; do
    if out="$(resolve "$fallback" .forge-review/standards.md 2>/dev/null)"; then
      echo "REVIEW_STANDARDS=$out" >> "$GITHUB_ENV"
      break
    fi
  done
fi
grep -q '^REVIEW_STANDARDS=' "$GITHUB_ENV" || {
  echo "::error::no standards file (tried $REVIEW_STANDARDS_IN, AGENTS.md, CONTRIBUTING.md)."
  exit 1
}

if out="$(resolve "${REVIEW_PROMPT_IN:?}" .forge-review/prompt.md)"; then
  echo "REVIEW_PROMPT=$out" >> "$GITHUB_ENV"
else
  echo "::error::prompt $REVIEW_PROMPT_IN missing — re-run bash scripts/sync-forge.sh to re-vendor."
  exit 1
fi
