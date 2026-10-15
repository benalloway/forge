# Forge configuration reference

Two surfaces, same knobs. Workflow inputs are preferred on GitHub Actions;
`FORGE_*` env wins everywhere (the runner normalizes both, so local runs and
the reusable workflow stay in sync). During migration from Sandcastle,
`SANDCASTLE_*` names are accepted as deprecated fallbacks (`FORGE_*` wins).

## Workflow inputs (`.github/workflows/forge.yml` → `benalloway/forge`)

| Input | Default | When to change |
|---|---|---|
| `label` | `Forge` | Backlog label. Migrating Sandcastle repos pass `Sandcastle` until they re-label. |
| `branch_prefix` | `forge` | Per-issue branches `<prefix>/issue-<id>`. Change only to avoid a collision. |
| `model` | `opencode/muse-spark-1.3-contributor-free` | Any OpenCode model ID. |
| `max_iterations` | `5` | Plan → execute → merge cycles per run. |
| `delivery` | `push` | `push` (direct to `main`) or `pr` (open a review PR). |
| `node_version` | `24` | Node for the runner only — your repo can be any stack. |
| `verify_command` | `npm run check && npm run build` | **Required for non-Node repos.** Your stack's gate (e.g. `cargo test`, `go test ./...`, `make verify`). Runs before any delivery. |
| `setup_command` | `[ -d node_modules ] \|\| npm install …` | **Required for non-Node repos.** Per-worktree setup (e.g. `cargo fetch`, `go mod download`, `pip install -r requirements.txt`). |
| `standards_file` | `.sandcastle/CODING_STANDARDS.md` | Reviewer standards file. Any path; missing file falls back to `AGENTS.md`. |

## Environment (`FORGE_*`)

| Variable | Default | Notes |
|---|---|---|
| `FORGE_LABEL` | `Forge` | Same as `label` input. |
| `FORGE_BRANCH_PREFIX` | `forge` | Same as `branch_prefix`. |
| `FORGE_MODEL` | (see above) | Same as `model`. |
| `FORGE_MAX_ITERATIONS` | `10` | Local default is higher; the workflow passes `5`. |
| `FORGE_SANDBOX` | `local` | `local` (git worktrees, no Docker) · `docker` · `podman`. |
| `FORGE_STANDARDS_FILE` | `.sandcastle/CODING_STANDARDS.md` | Same as `standards_file`. |
| `FORGE_DELIVERED_FILE` | `.sandcastle/delivered-issues.txt` | Merger → workflow handoff. Gitignored; never commit it. |
| `FORGE_SETUP_COMMAND` | (node default above) | Same as `setup_command`. |
| `FORGE_PROMPTS_DIR` | `<runner>/prompts/` | Fork prompts per repo only as a last resort — prefer improving upstream. |
| `OPENCODE_API_KEY` | — | Required (or `opencode auth login` locally; repo/org secret in Actions). |
| `GH_TOKEN` / `GITHUB_TOKEN` | — | `gh` auth. A PAT (`FORGE_GH_TOKEN`) is recommended: pushes trigger downstream CI and PR mode works. |

## Non-Node repos

Set `verify_command` + `setup_command` — that is the entire port. Prompts
already instruct agents to discover verify commands from the repo itself; the
two settings make the workflow gate and worktree setup match. Everything else
(model, labels, delivery) is stack-independent.

## Triage vocabulary

The planner excludes `needs-triage`, `needs-info`, `ready-for-human`,
`wontfix` by default and works on the rest of the backlog label. Keep this
vocabulary in consumers; changing it requires forking `plan-prompt.md`
(`FORGE_PROMPTS_DIR`), which is intentionally the only non-knob in the system.
