# CHANGES — Forge release log

Newest first. One entry per behavior change: Change / Consumer impact / Rollback.

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
