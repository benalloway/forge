# Forge costs & trust (read before your first AFK run)

Agents cost money and take unsupervised actions. This page states both
plainly so nobody learns it from an invoice or a surprise push.

## What a run can spend

Every agent iteration is model usage billed to your key (OpenCode Zen credit
or your direct provider account — see `docs/CONFIGURATION.md`). Forge bounds
work with two caps, outer × inner:

| Cap | Env / input | Default | Effect |
|---|---|---|---|
| Run cycles | `FORGE_MAX_ITERATIONS` / `max_iterations` | 10 local · 5 Actions | Plan → execute → merge loops per run. |
| Implementer iterations | `FORGE_IMPLEMENT_MAX_ITERATIONS` | 100 | Agentic steps per issue. **The dominant cost lever.** |

Cost scales with: issues per run × iterations per issue × model price.
The planner pre-check and empty-backlog exits cost nothing (no agent call).

## Bounding a run (checklist)

1. Start on a cheap model; escalate per-issue only if quality demands it.
2. Lower `FORGE_IMPLEMENT_MAX_ITERATIONS` (e.g. `25`) until you know an
   issue class's typical shape. Small docs/config issues rarely need more.
3. Keep `max_iterations` low on Actions (default `5`); local exploration can
   go higher since you watch it.
4. Dry-run first: trigger the workflow with an empty backlog and confirm it
   exits cleanly (`No open issues labeled …`) before labeling real work.
5. Prefer small, single-scope issues — the planner parallelizes them, and
   small scopes finish in fewer iterations.

## What a run can change

- Branches `forge/issue-<id>` (or your `branch_prefix`) are created, merged,
  and — in `push` delivery — landed on your trunk, which typically
  auto-deploys via your CI. Reviewer + merger + verify gates mitigate, but do
  not eliminate, bad landings.
- Issues are closed only after delivery succeeds (push landed, or PR merged
  via `Closes #…`). Failed runs leave issues open for retry by design.

## Recommended posture for new adopters

1. `delivery: pr` (the default), branch protection + required CI on the base
   branch, and merge PRs yourself until you trust a repo's issue class.
2. Graduate specific repos to `delivery: push` only with green CI gating
   deploys and owners who accept auto-deploy on merge.
3. Never attach a production-secret-bearing environment to agent sandboxes
   beyond what the task needs; provider keys flow via `FORGE_FORWARD_ENV`
   and are never logged.

Honesty section: cost figures above are structural, not measured — publish
measured per-issue costs from pilot runs here as they land (Node/Astro first,
non-Node pending).
