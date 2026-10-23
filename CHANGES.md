# CHANGES — Forge release log

Newest first. One entry per behavior change: Change / Consumer impact / Rollback.

---

## v1 (unreleased) — Review model fallback

Change: `review.yml` gains additive `fallback_model` input (default
`opencode/deepseek-v4.1-flash-free`, single-sourced as `review_fallback_model`
in `runner/models.json`). The agent step tries the primary once, then retries
with the fallback — paid primaries fail on exhausted API budgets (`Policy
budget exceeded`, observed on the first Haiku runs) and rotating IDs (`Model
not found`, observed minutes later). Fixes #7.

Consumer impact: None required — thin wrappers inherit the new default
through `@v1` (they don't pin `model`).

Rollback: Set `fallback_model` equal to `model`, or re-pin to previous `v1`.

---

## v1 (unreleased) — Single-source models + review upsert

Change: Model defaults live in `runner/models.json`; `scripts/sync-models.mjs`
propagates to workflow inputs + docs (`--check` in CI fails on drift, so a
review-model change is one edit). Review comments upsert in place (reruns
update instead of stacking), agent timeout 30→60m for free-model queues.
Fixed while here: template-literal `[\s\S]` pitfall documented in the script.

Consumer impact: None required — review upsert is live on release;
`models.json` re-vendors with the next `sync-forge.sh`.

Rollback: Re-pin `scripts/forge-version.txt` to the previous tag and re-run
`bash scripts/sync-forge.sh`.

---

## v1 (unreleased) — Per-role models

Change: Factory roles now take separate models (`plan_model`,
`implement_model`, `review_model`, `merge_model` inputs / `FORGE_*_MODEL`
env), each defaulting to a recommended lineup entry; blank inherits the
global `model`. Defaults refreshed after the `muse-spark-1.3-contributor-free`
retirement broke all runs: global `opencode/deepseek-v4.1-flash-free`
(free, zero-retention), planner `opencode-go/muse-spark-1.3-contributor`
(flagship reasoning at $0.10/M — contributor tier trains on prompts, swap
for private repos), reviewer `opencode/claude-haiku-5-5` (PR review default
too). Same `OPENCODE_API_KEY` authorizes `opencode-go/*` (verified in the
pinned CLI) — no new secret needed.

Consumer impact: Cloud runs pick up the lineup automatically (no wrapper
changes). Re-run `bash scripts/sync-forge.sh` so local runs match.
`FORGE_MODEL`-only setups now affect only roles left blank (all four ship
pinned — set all five to move everything).

Rollback: Set the five model inputs/envs back to a single previous ID, or
re-pin `scripts/forge-version.txt` and re-run `bash scripts/sync-forge.sh`.

---

## v1 (unreleased) — PR review + canonical labels

Change: New reusable workflow `.github/workflows/review.yml`: read-only
PR review agent (standards file + vendored
`runner/prompts/pr-review-prompt.md`), posts one advisory comment
(`APPROVE`/`COMMENT`) per PR, never pushes. New `scripts/setup-labels.sh`:
canonical label vocabulary (backlog + triage roles + `bug`/`enhancement` +
routing `run:home`/`run:cloud`), idempotent, `--force` enforces canonical
colors. `docs/INSTALL.md` Step 1 now fetches that script (inline loop
removed — single source of truth) plus a new Step 9 wiring the review
wrapper; `docs/CONFIGURATION.md` documents review inputs.

Consumer impact: Re-run `bash scripts/sync-forge.sh` to vendor the new
prompt, add the ~25-line `review.yml` wrapper (INSTALL Step 9), run
`setup-labels.sh` for the routing labels. No changes to existing factory
behavior.

Rollback: Delete the `review.yml` wrapper to stop reviews; re-pin
`scripts/forge-version.txt` to the previous tag and re-run
`bash scripts/sync-forge.sh`.

---

## v1 (unreleased) — Initial Forge extraction

Change: Extracted the AFK issue factory (Sandcastle lineage) into
`benalloway/forge`: env-driven generic runner (`runner/main.ts` + prompts),
reusable workflow (`.github/workflows/forge.yml`), vendor script
(`scripts/sync-forge.sh` + version pin), agent-executable `docs/INSTALL.md`.
Fixed the premature issue-close bug (issues now close only after delivery
succeeds) and hardened `delivery=pr` (clear permission error, `Closes #…` in
PR body, issues stay open on failure). No deploy step in the factory — pushing
to `main` triggers the consumer's own CI, which owns deploys. Amended pre-
adoption: `base_branch` input (trunk is no longer assumed `main`),
`opencode_version` input (CLI pinned, never floats), generic direct-provider
model keys (`anthropic/openai/gemini` optional secrets + `FORGE_FORWARD_ENV`
passthrough).

Consumer impact: New installs via `docs/INSTALL.md`. Migrating Sandcastle
repos pass `label: Sandcastle` (+ existing `SANDCASTLE_*` env keeps working as
deprecated fallbacks) until they adopt the `Forge` label.

Rollback: Re-pin `scripts/forge-version.txt` to the previous tag and re-run
`bash scripts/sync-forge.sh`.
