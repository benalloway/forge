# Forge — reusable AFK issue factory

Run GitHub issues to completion while you sleep: a **planner** picks unblocked
work, **implementers** build each issue in an isolated git worktree,
a **reviewer** refines each branch, and a **merger** merges everything back and
hands off for delivery.

Lineage: Forge is an opinionated distribution built on
[`@ai-hero/sandcastle`](https://github.com/mattpocock/sandcastle) (the agent
orchestration library: sandboxes, worktrees, agent loop) — the runner,
delivery guarantees (close-only-after-delivery), versioned distribution, and
agent-executable install docs are Forge's own. MIT licensed; see `LICENSE`.

Forge is generic across **GitHub** repos — the only tracker it speaks is
GitHub issues, the only CI it targets is GitHub Actions. Stack-wise it is
**Node-first, designed for others**: proven on Astro/Node (typecheck + build
gates), with `verify_command` / `setup_command` hooks for any other stack
(first non-Node pilot still pending — see `docs/COSTS.md` for the honesty
section on cost and trust). The only things Forge assumes are **git + GitHub
issues**; labels, branches, models, and deploys are consumer-configured.

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
- `.github/workflows/review.yml` — reusable read-only PR review: one advisory
  comment per PR, never pushes (`GITHUB_TOKEN` suffices).
- `scripts/setup-labels.sh` — canonical label vocabulary (backlog, triage
  roles, routing), idempotent; `scripts/sync-forge.sh` — vendor script (mirrors the `@benalloway/ui`
  `ui:sync` pattern): copies `runner/` at a pinned tag.

## Trust model (read before your first run)

Forge runs agents with full tool permissions (`OPENCODE_PERMISSION: * allow`
+ non-interactive auto-approve) and, in `push` delivery, lands commits
straight onto your trunk. That is the AFK dream and also a loaded footgun:

- **New adopters: start with `delivery: pr`.** It is the default. Review the
  branch, merge when happy, issues close on merge.
- **Unattended `push` is opt-in** (`delivery: push` in the wrapper) for repos
  with green CI, branch protection, and owners who accept auto-deploy.
- **Know your spend.** See `docs/COSTS.md` for caps and how to bound a run
  before you walk away.

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
