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
<!-- MODELS:factory:BEGIN -->
| `model` | `opencode/deepseek-v4.1-flash-free` | Global default; blank role values inherit it. Free tier, zero-retention — free IDs rotate, see Troubleshooting in INSTALL.md. |
| `plan_model` | `opencode-go/muse-spark-1.3-contributor` | Planner (reasons once per cycle). Contributor tier: prompts may train future models, geo-limited — swap for a zero-retention model in private repos. Same `OPENCODE_API_KEY` authorizes it (same Console account). |
| `implement_model` | `opencode/deepseek-v4.1-flash-free` | Implementer (dominates cost). |
| `review_model` | `opencode/claude-haiku-5-5` | In-branch reviewer ($0.10/M in). |
| `merge_model` | `opencode/deepseek-v4.1-flash-free` | Merger. |
<!-- MODELS:factory:END -->
| `max_iterations` | `5` | Plan → execute → merge cycles per run. |
| `delivery` | `pr` | `pr` (review PR — the safe default) or `push` (direct to base branch, for repos with green CI + branch protection). |
| `base_branch` | `main` | Trunk the factory merges into and delivers to. Set for repos on `master`/`develop`/etc. |
| `node_version` | `24` | Node for the runner only — your repo can be any stack. |
| `base_branch` | `main` | Trunk the factory merges into and delivers to. Set for repos on `master`/`develop`/etc. |
| `opencode_version` | `1.18.34` | Pinned CLI (never floats). Bump deliberately after testing a new release. |
| `verify_command` | `npm run check && npm run build` | **Required for non-Node repos.** Your stack's gate (e.g. `cargo test`, `go test ./...`, `make verify`). Runs before any delivery. |
| `setup_command` | `[ -d node_modules ] \|\| npm install …` | **Required for non-Node repos.** Per-worktree setup (e.g. `cargo fetch`, `go mod download`, `pip install -r requirements.txt`). |
| `standards_file` | `.sandcastle/CODING_STANDARDS.md` | Reviewer standards file. Any path; missing file falls back to `AGENTS.md`. |

## Review workflow inputs (`.github/workflows/review.yml` → `benalloway/forge`)

| Input | Default | When to change |
|---|---|---|
<!-- MODELS:review:BEGIN -->
| `model` | `opencode/claude-haiku-5-5` | Any OpenCode model ID. PR review is a single careful read — cheap + reliable beats free here (~1¢/review). |
<!-- MODELS:review:END -->
| `standards_file` | `.sandcastle/CODING_STANDARDS.md` | Reviewer standards file. Missing file falls back to `AGENTS.md`. |
| `prompt_file` | `.forge/prompts/pr-review-prompt.md` | Fork the prompt per repo only as a last resort — prefer improving upstream (it re-vendors via `sync-forge.sh`). |
| `node_version` | `24` | Node for the runner only. |
| `opencode_version` | `1.18.34` | Pinned CLI (never floats). Bump deliberately. |

Secrets: `opencode_api_key` (required), `gh_token` (required, but
`GITHUB_TOKEN` suffices — the review only reads the PR and posts a comment,
never pushes). The agent step receives no GitHub token at all.

## Environment (`FORGE_*`)

| Variable | Default | Notes |
|---|---|---|
| `FORGE_LABEL` | `Forge` | Same as `label` input. |
| `FORGE_BRANCH_PREFIX` | `forge` | Same as `branch_prefix`. |
| `FORGE_MODEL` | (see above) | Same as `model`. |
| `FORGE_PLAN_MODEL` / `FORGE_IMPLEMENT_MODEL` / `FORGE_REVIEW_MODEL` / `FORGE_MERGE_MODEL` | (lineup above) | Same as the role inputs. Set any role to `""` to inherit `FORGE_MODEL`. |
| `FORGE_MAX_ITERATIONS` | `10` | Local default is higher; the workflow passes `5`. |
| `FORGE_IMPLEMENT_MAX_ITERATIONS` | `100` | Per-issue implementer cap — the dominant cost lever (see `docs/COSTS.md`). |
| `FORGE_SANDBOX` | `local` | `local` (git worktrees, no Docker) · `docker` · `podman`. |
| `FORGE_STANDARDS_FILE` | `.sandcastle/CODING_STANDARDS.md` | Same as `standards_file`. |
| `FORGE_DELIVERED_FILE` | `.sandcastle/delivered-issues.txt` | Merger → workflow handoff. Gitignored; never commit it. |
| `FORGE_SETUP_COMMAND` | (node default above) | Same as `setup_command`. |
| `FORGE_REPO` | `benalloway/forge` | Upstream repo for the vendor script. Forks set this to their own repo and `sync-forge.sh` + these docs follow. |
| `FORGE_PROMPTS_DIR` | `<runner>/prompts/` | Fork prompts per repo only as a last resort — prefer improving upstream. |
| `OPENCODE_API_KEY` | — | Required (or `opencode auth login` locally; repo/org secret in Actions). |
| `GH_TOKEN` / `GITHUB_TOKEN` | — | `gh` auth. A PAT (`FORGE_GH_TOKEN`) is recommended: pushes trigger downstream CI and PR mode works. |
| `FORGE_FORWARD_ENV` | — | Comma-separated env names forwarded into agent sandboxes (values never logged). The workflow sets `ANTHROPIC_API_KEY,OPENAI_API_KEY,GEMINI_API_KEY` by default; extend locally for other providers. |

## Model providers

The agent runtime is OpenCode, so **any provider OpenCode routes works via
the `model` input** (e.g. `opencode/<slug>`, `anthropic/<model>`,
`openai/<model>`) — no Forge changes needed. Authentication has two paths:

1. **OpenCode Zen (default):** `OPENCODE_API_KEY` covers everything. Nothing
   else to set.
2. **Direct provider keys:** pass the provider secret (`anthropic_api_key`,
   `openai_api_key`, `gemini_api_key` workflow secrets — all optional) and
   address the model directly. Keys reach agents exclusively through
   `FORGE_FORWARD_ENV` forwarding, never through logs or prompts.

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

Routing (`run:home` / `run:cloud`, default cloud) is a consumer-side
convention, not a runner knob: the cloud `forge.yml` wrapper skips
`run:home` via a job `if:` guard, and the home-server runner polls the
`run:home` queue. See `scripts/setup-labels.sh` for the canonical set.
