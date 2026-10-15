# Install Forge in a repo (agent-executable)

> Human: point an agent at this repo and say “follow `docs/INSTALL.md` to
> install Forge in `<repo>`”. The agent should complete every step below in
> order and stop only for the marked HUMAN step. Repeat installs must follow
> the same steps — no shortcuts, no version guessing.

**Done looks like:** `.forge/` vendored + pinned, wrapper workflow present,
labels present, standards file present, `package.json` scripts present,
`.gitignore` covers agent state, secrets checklist handed to the human, and a
dry-run factory execution exits cleanly with an empty backlog.

**Conventions:** Forge release tags look like `v1`, `v1.1`. Default to `v1`
unless the human names another tag. Never use branch names or `main` as the
pin — only immutable tags.

## 0. Inspect the target repo

```sh
git -C <repo> status -sb && git -C <repo> branch --show-current
ls <repo>
cat <repo>/package.json 2>/dev/null | head -n 40 || echo "NO package.json (non-Node repo — verify_command + setup_command are REQUIRED)"
ls <repo>/.github/workflows 2>/dev/null || echo "NO workflows dir"
gh label list --repo <owner>/<repo> --limit 50 --json name,color --jq '.[].name'
```

Record: package manager / language, existing verify commands (scripts like
`check`/`build`/`test`/`lint`, Makefile targets, CI jobs), whether labels
below already exist.

## 1. Create labels (skip any that already exist)

```sh
R=<owner>/<repo>
EXISTING="$(gh label list --repo "$R" --limit 100 --json name --jq '.[].name')"
for spec in \
  "Forge:F9A825:Issues for Forge to work on" \
  "needs-triage:FBCA04:Needs triage before planning" \
  "needs-info:FEF2C0:Blocked on a question for the owner" \
  "ready-for-agent:0E8A16:Fully specified, ready for an AFK agent" \
  "ready-for-human:5319E7:Requires human implementation" \
  "wontfix:E4E669:Decided not to do" \
  "bug:D73A4A:Something is broken" \
  "enhancement:A2EEEF:New feature or improvement"; do
  name="${spec%%:*}"; rest="${spec#*:}"; color="${rest%%:*}"; desc="${rest#*:}"
  echo "$EXISTING" | grep -Fxq "$name" \
    && echo "exists: $name" \
    || gh label create "$name" --repo "$R" --color "$color" --description "$desc"
done
```

If the repo migrates from Sandcastle, keep its `Sandcastle` label and pass
`label: Sandcastle` in the wrapper until you re-label those issues to `Forge`
and drop the override.

## 2. Fetch the vendor script and vendor the runner

```sh
cd <repo> && mkdir -p scripts .forge
REF="v1"  # or the human-named tag
# Forks: export FORGE_REPO=<owner>/<repo> first — the fetch and vendor follow it.
gh api "repos/${FORGE_REPO:-benalloway/forge}/contents/scripts/sync-forge.sh?ref=${REF}" \
  --jq .content | base64 -d > scripts/sync-forge.sh
bash scripts/sync-forge.sh "$REF"
git status --short  # expect: scripts/sync-forge.sh, scripts/forge-version.txt, .forge/
```

Verify the pin: `cat scripts/forge-version.txt` must print exactly `$REF`,
and `.forge/main.ts` + `.forge/prompts/` + `.forge/package.json` must exist.

## 3. Add the reviewer standards file

The reviewer reads this file (default path `.sandcastle/CODING_STANDARDS.md`,
overridable via `standards_file`). Write one grounded in the repo you
inspected in Step 0: stack, style source of truth, portability boundaries,
verify commands, and the rule that production-behavior changes ship with a
changelog/rollback note. Keep it under ~50 lines. If the repo already has
`.sandcastle/CODING_STANDARDS.md` (Sandcastle migration), keep it as-is.

## 4. Add the wrapper workflow `.github/workflows/forge.yml`

Save exactly this (adjust only the `with:` block per Step 0; non-Node repos
MUST set `verify_command` and usually `setup_command` — see
`docs/CONFIGURATION.md`):

```yaml
name: Forge

on:
  workflow_dispatch:
    inputs:
      max_iterations:
        description: "Maximum plan -> execute -> merge cycles"
        required: false
        default: "5"
        type: string
      delivery:
        description: "How to deliver merged commits"
        required: false
        default: "pr"
        type: choice
        options:
          - push
          - pr
  issues:
    types: [labeled]

concurrency:
  group: forge-factory
  cancel-in-progress: false

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  forge:
    # Forks: replace benalloway/forge with <owner>/forge (and set FORGE_REPO for the vendor script).
    uses: benalloway/forge/.github/workflows/forge.yml@v1
    with:
      # label: Sandcastle        # uncomment while migrating from Sandcastle
      # base_branch: master      # uncomment if your trunk is not `main`
      # delivery: push           # uncomment ONLY for repos with green CI + branch protection (default pr)
      # verify_command: "make verify"
      # setup_command: "go mod download"
    secrets:
      opencode_api_key: ${{ secrets.OPENCODE_API_KEY }}
      gh_token: ${{ secrets.FORGE_GH_TOKEN || secrets.GITHUB_TOKEN }}
      # anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}  # only for direct-provider models
```

Notes the agent must convey in its final summary:

- `uses:` pins the major tag (`@v1`), matching `scripts/forge-version.txt`.
  Bump both together when upgrading.
- `permissions:` MUST live in this wrapper (reusable workflows cannot grant
  their own). `contents: write` lets the factory push; `issues: write` lets
  it close/comment; `pull-requests: write` is needed for `delivery: pr` from
  `GITHUB_TOKEN` — without it (or a PAT), PR creation fails while the branch
  is still pushed (issues stay open for retry by design).
- Delivery defaults to `pr` (safe). Switch a repo to `push` only with green
  CI gating deploys plus branch protection — see `docs/COSTS.md` trust notes.
- The `issues: [labeled]` trigger fires only when an issue gains the backlog
  label AND already carries `ready-for-agent` (or vice versa); the reusable
  workflow re-checks both.

## 5. Add scripts and ignore agent state

```sh
cd <repo>
npm pkg set scripts.forge="npx tsx .forge/main.ts" 2>/dev/null \
  || python3 -c "import json;p='package.json';d=json.load(open(p));d.setdefault('scripts',{})['forge']='npx tsx .forge/main.ts';json.dump(d,open(p,'w'),indent=2)"
```

 Non-Node repos without `package.json`: add the equivalent one-liner to the
 repo's task runner / `CONTRIBUTING.md` instead (`npx --yes tsx .forge/main.ts`
 needs Node 22+ on `PATH` — the factory runner itself always needs Node, even
 when the target repo does not).

 Then ensure agent state is ignored (create `.gitignore` if missing, never
 duplicate lines):

```sh
cd <repo> && touch .gitignore
for line in ".forge/node_modules/" ".sandcastle/logs/" ".sandcastle/worktrees/" ".sandcastle/delivered-issues.txt" ".sandcastle/.env"; do
  grep -qxF "$line" .gitignore || echo "$line" >> .gitignore
done
```

Also add convenient triggers (optional but recommended):

```sh
cd <repo>
npm pkg set scripts.forge:gh="gh workflow run forge.yml && sleep 2 && gh run watch" 2>/dev/null || true
npm pkg set scripts.forge:gh:pr="gh workflow run forge.yml -f delivery=pr && sleep 2 && gh run watch" 2>/dev/null || true
```

## 6. Secrets — HUMAN STEP (stop and hand over)

The agent MUST NOT create, read, or echo secret values. Output this checklist
to the human instead (repository or organization secrets):

- `OPENCODE_API_KEY` — required. Agent runtime key.
- `FORGE_GH_TOKEN` — strongly recommended PAT (fine-grained: Contents RW,
  Issues RW, Pull requests RW, Metadata R). Without it the factory falls back
  to `GITHUB_TOKEN`, which (a) cannot open PRs unless the repo enables
  “Allow GitHub Actions to create and approve pull requests”
  (Settings → Actions → General), and (b) its pushes do NOT trigger
  downstream workflows (so CI deploys would not fire after a factory push).
  Organization secret preferred — set once, every repo inherits it.
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` — optional, only
  for direct-provider models (OpenCode Zen via `OPENCODE_API_KEY` needs none
  of these). See `docs/CONFIGURATION.md` → Model providers.
- Deploy secrets (e.g. Cloudflare tokens) stay in the consumer repo as
  before; Forge never touches deploys (push to `main` triggers consumer CI).

Resume after the human confirms secrets exist.

## 7. Verify — dry run with an empty backlog

```sh
cd <repo> && git add -A && git status --short  # review, do NOT commit unless asked
python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/forge.yml'));print('wrapper YAML OK')" 2>/dev/null \
  || node -e "console.log('skip local YAML check: no yaml module')"
gh workflow run forge.yml && sleep 10 && gh run watch
```

Expected: the run succeeds with `No open issues labeled '<label>'. Exiting
cleanly.` (the pre-check exits before any agent/LLM call, so this costs
practically nothing). If it fails, see Troubleshooting; do not proceed to
Step 8 with a red dry run.

## 8. First live issue (optional)

Open a small, well-specified issue, label it `needs-triage` + backlog label,
triage it to `ready-for-agent`, and trigger the workflow. Watch one full
cycle, then review the branch, merge path, and issue close before handing the
repo over.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `gh pr create failed` in Verify | PR permission (see Step 4 notes). Branch is pushed and issues stay open — create the PR manually (`gh pr create --base main --head <branch>`) or add the PAT/setting and re-run. |
| Issue closed but nothing on the base branch | Pre-v1 bug (merger closed before push). Reopen the issue and re-run; v1+ closes only after delivery. |
| Second run says “No unblocked issues” but work is missing | Same as above — check whether the previous run actually delivered before its close. |
| `tsx: command not found` locally | `npm i -D tsx` in the consumer, or use `npx --yes tsx`. |
| Slow first GH run | `npm ci` in `.forge/` + model queue; subsequent runs reuse caches. Free-tier models can queue several minutes. |
| Non-Node repo fails at Verify/setup | `verify_command` / `setup_command` not set — Step 0/4. The runner is Node; the repo need not be. |
| Two factory runs overlapping | `concurrency: forge-factory` serializes them; the second waits. Never remove the group. |
