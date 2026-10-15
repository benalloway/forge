# CHANGES — Forge release log

Newest first. One entry per behavior change: Change / Consumer impact / Rollback.

---

## v1 (unreleased) — Initial Forge extraction

Change: Extracted the AFK issue factory (Sandcastle lineage) into
`benalloway/forge`: env-driven generic runner (`runner/main.ts` + prompts),
reusable workflow (`.github/workflows/forge.yml`), vendor script
(`scripts/sync-forge.sh` + version pin), agent-executable `docs/INSTALL.md`.
Fixed the premature issue-close bug (issues now close only after delivery
succeeds) and hardened `delivery=pr` (clear permission error, `Closes #…` in
PR body, issues stay open on failure). No deploy step in the factory — pushing
to `main` triggers the consumer's own CI, which owns deploys.

Consumer impact: New installs via `docs/INSTALL.md`. Migrating Sandcastle
repos pass `label: Sandcastle` (+ existing `SANDCASTLE_*` env keeps working as
deprecated fallbacks) until they adopt the `Forge` label.

Rollback: Re-pin `scripts/forge-version.txt` to the previous tag and re-run
`bash scripts/sync-forge.sh`.
