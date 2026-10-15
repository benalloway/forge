# Forge — reusable AFK issue factory

Run GitHub issues to completion while you sleep: a **planner** picks unblocked
work, **implementers** build each issue in an isolated git worktree,
a **reviewer** refines each branch, and a **merger** merges everything back and
hands off for delivery. Generic across repos and stacks — the only thing Forge
assumes is **git + GitHub issues**; verify commands, standards, labels, and
deploys are all consumer-configured with sane defaults.

```
issue (needs-triage) → triage → ready-for-agent + <backlog-label>
  → runs locally (`npm run forge`) or on GitHub Actions (reusable workflow)
  → merges + pushes (or opens a PR) → consumer CI deploys → verify live
```

## Use it in your repo (3 steps)

Point an agent at this repo and tell it: **“follow `docs/INSTALL.md` to
install Forge in `<repo>`.”** The guide is written to be executed repeatably
without guesswork. Human summary:

1. `bash scripts/sync-forge.sh v1` — vendors the version-pinned runner into
   `.forge/` (`scripts/forge-version.txt` records the pin).
2. Add the thin wrapper `.github/workflows/forge.yml` (~20 lines, calls the
   reusable workflow) + backlog labels + secrets (`OPENCODE_API_KEY`,
   `FORGE_GH_TOKEN` or `GITHUB_TOKEN`).
3. Label an issue `<backlog-label>` + `ready-for-agent` — the factory picks it
   up on the next run.

Details: [`docs/INSTALL.md`](./docs/INSTALL.md) (agent-executable install),
[`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md) (every knob).

## Layout

- `runner/main.ts` — the factory loop (plan → execute+review → merge).
  Driven entirely by `FORGE_*` env (see `docs/CONFIGURATION.md`).
- `runner/prompts/` — planner / implementer / reviewer / merger prompts.
  Stack-agnostic: agents discover each repo's verify commands at runtime
  instead of assuming `npm` scripts.
- `runner/Dockerfile` — optional container sandbox image.
- `.github/workflows/forge.yml` — reusable workflow (`workflow_call`) consumers
  wrap. No deploy step on purpose: pushing to `main` triggers the consumer's
  own CI, which owns deploys.
- `scripts/sync-forge.sh` — vendor script (mirrors the `@benalloway/ui`
  `ui:sync` pattern): copies `runner/` at a pinned tag.

## What Forge needs from a consumer repo

- A backlog label (default `Forge`) + the triage-role vocabulary
  (`needs-triage` → `ready-for-agent` / `ready-for-human` / `wontfix`).
- A coding-standards file for the reviewer (default
  `.sandcastle/CODING_STANDARDS.md` — any path works via `standards_file`).
- Verify commands the agents can discover (`package.json` scripts,
  `AGENTS.md`, or equivalent — any language/stack).
- `.sandcastle/` stays reserved as the agent state dir (git worktrees, logs —
  all gitignored; hardcoded by the underlying runner library).

## Versioning

Tags: `v1`, `v1.1`, … Consumers pin a major (`v1`) in `sync-forge.sh` and in
the wrapper workflow. Rules: never break or rename a `workflow_call` input or
a `FORGE_*` variable within a major; additive only. Changes land in `CHANGES.md`.
