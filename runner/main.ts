// Forge — generic AFK issue factory (planner → execute+review → merger).
//
// Runs:
//   1. Locally WITHOUT Docker (default: `noSandbox()` + git worktrees per issue)
//   2. In GitHub Actions (via the reusable workflow `.github/workflows/forge.yml`)
//   3. Optionally in Docker or Podman (`FORGE_SANDBOX=docker` or `podman`)
//
// Everything is driven by `FORGE_*` environment (see docs/CONFIGURATION.md).
// `SANDCASTLE_*` names are accepted as deprecated fallbacks during migration.
// The only consumer-repo conventions assumed: git + GitHub issues, a backlog
// label, and a coding-standards file for the reviewer. Verify commands are
// discovered at runtime by the agents, never hardcoded here.
//
// NOTE: `.sandcastle/` (worktrees/logs) is hardcoded by @ai-hero/sandcastle
// and used as-is for agent state (gitignored in consumers).

import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import { podman } from "@ai-hero/sandcastle/sandboxes/podman";
import { z } from "zod";

const planSchema = z.object({
  issues: z.array(
    z.object({ id: z.string(), title: z.string(), branch: z.string() }),
  ),
});

// ---------------------------------------------------------------------------
// Configuration (override via environment; see docs/CONFIGURATION.md)
// ---------------------------------------------------------------------------

function env(name: string, fallback: string): string {
  const current = process.env[`FORGE_${name}`];
  const legacy = process.env[`SANDCASTLE_${name}`];
  if (current === undefined && legacy !== undefined) {
    console.warn(
      `Forge: SANDCASTLE_${name} is deprecated, use FORGE_${name} instead.`,
    );
  }
  return current ?? legacy ?? fallback;
}

type SandboxMode = "local" | "no-sandbox" | "docker" | "podman";

const SANDBOX_MODE = env("SANDBOX", "local").toLowerCase() as SandboxMode;

/**
 * Model lineup, single-sourced from models.json (same dir). Edit the JSON,
 * then run `node scripts/sync-models.mjs` to propagate to the reusable
 * workflows and docs — CI fails if they drift.
 */
interface ModelDefaults {
  model: string;
  plan_model: string;
  implement_model: string;
  review_model: string;
  merge_model: string;
}
const DEFAULTS = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./models.json", import.meta.url)),
    "utf8",
  ),
) as ModelDefaults;
for (const k of [
  "model",
  "plan_model",
  "implement_model",
  "review_model",
  "merge_model",
] as const) {
  if (typeof DEFAULTS[k] !== "string" || DEFAULTS[k].length === 0) {
    throw new Error(`models.json: missing or empty "${k}"`);
  }
}

const MODEL = env("MODEL", DEFAULTS.model);

/**
 * Per-role models. Planner reasons once per cycle (quality first: flagship
 * reasoning at flash prices); implementer dominates cost (cheap + strong
 * tools, zero-retention free tier); reviewer reads once (cheap + careful);
 * merger reconciles branches. Override any role via its FORGE_* env (local)
 * or workflow input (Actions). Set a role to "" to inherit MODEL; set MODEL
 * to move all inheritors.
 * Privacy note: the planner default is a contributor-tier model — prompts
 * may train future models. Swap it for a zero-retention model when working
 * in private repos (see docs/CONFIGURATION.md).
 */
const PLAN_MODEL = env("PLAN_MODEL", DEFAULTS.plan_model);
const IMPLEMENT_MODEL = env("IMPLEMENT_MODEL", DEFAULTS.implement_model);
const REVIEW_MODEL = env("REVIEW_MODEL", DEFAULTS.review_model);
const MERGE_MODEL = env("MERGE_MODEL", DEFAULTS.merge_model);

/** Blank role value inherits the global MODEL. */
const roleModel = (v: string): string => (v === "" ? MODEL : v);

const MAX_ITERATIONS = Number.parseInt(env("MAX_ITERATIONS", "10"), 10);

/**
 * Per-issue implementer iteration cap. The dominant cost lever: each
 * iteration is agentic work against the model. Lower for cheap models and
 * tight budgets; see docs/COSTS.md.
 */
const IMPLEMENT_MAX_ITERATIONS = Number.parseInt(
  env("IMPLEMENT_MAX_ITERATIONS", "100"),
  10,
);

/** GitHub issue label marking the factory backlog (default triage: `Forge`). */
const LABEL = env("LABEL", "Forge");

/** Branch prefix for per-issue work (`<prefix>/issue-<id>`). */
const BRANCH_PREFIX = env("BRANCH_PREFIX", "forge");

/** Coding-standards file the reviewer reads (consumer-owned). */
const STANDARDS_FILE = env(
  "STANDARDS_FILE",
  ".sandcastle/CODING_STANDARDS.md",
);

/** Handoff file where the merger records delivered issue IDs (gitignored). */
const DELIVERED_FILE = env(
  "DELIVERED_FILE",
  ".sandcastle/delivered-issues.txt",
);

/** Setup command run in each issue worktree (override per stack). */
const SETUP_COMMAND = env(
  "SETUP_COMMAND",
  "[ -d node_modules ] || npm install --prefer-offline --no-audit --no-fund",
);

/** Prompts ship with the runner; override only to fork them per repo. */
const PROMPTS_DIR = env(
  "PROMPTS_DIR",
  fileURLToPath(new URL("./prompts/", import.meta.url)),
);

const promptFile = (name: string) => join(PROMPTS_DIR, name);

function createSandboxProvider(): sandcastle.SandboxProvider {
  const forwardedEnv: Record<string, string> = {};
  // Agents need these inside sandboxes (prompts reference them).
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key.startsWith("FORGE_")) {
      forwardedEnv[key] = value;
    }
  }
  // Generic provider-token passthrough: comma-separated env names whose values
  // (if present) are forwarded so agents can use direct model-provider keys.
  // Never logged. Example: FORGE_FORWARD_ENV="ANTHROPIC_API_KEY,OPENAI_API_KEY".
  const forwardList = (process.env.FORGE_FORWARD_ENV ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const name of forwardList) {
    const value = process.env[name];
    if (value !== undefined) {
      forwardedEnv[name] = value;
    }
  }
  if (process.env.GITHUB_ACTIONS) {
    forwardedEnv.GITHUB_ACTIONS = process.env.GITHUB_ACTIONS;
  }
  if (process.env.OPENCODE_API_KEY) {
    forwardedEnv.OPENCODE_API_KEY = process.env.OPENCODE_API_KEY;
  }
  if (process.env.GH_TOKEN) {
    forwardedEnv.GH_TOKEN = process.env.GH_TOKEN;
  } else if (process.env.GITHUB_TOKEN) {
    forwardedEnv.GH_TOKEN = process.env.GITHUB_TOKEN;
  }

  switch (SANDBOX_MODE) {
    case "docker":
      return docker({ env: forwardedEnv });
    case "podman":
      return podman({ env: forwardedEnv });
    case "local":
    case "no-sandbox":
    default:
      return noSandbox({ env: forwardedEnv });
  }
}

/**
 * Wraps `sandcastle.opencode()` so that:
 * 1. OpenCode receives `--auto` (its native non-interactive permission
 *    auto-approval flag) instead of `--dangerously-skip-permissions`.
 * 2. `OPENCODE_PERMISSION` is set to allow all tool calls in unattended runs.
 */
function createAgent(model = MODEL): sandcastle.AgentProvider {
  const base = sandcastle.opencode(model, {
    env: {
      OPENCODE_PERMISSION: JSON.stringify({ "*": "allow" }),
    },
  });

  return {
    ...base,
    buildPrintCommand(options) {
      const cmd = base.buildPrintCommand(options);
      return {
        ...cmd,
        command: cmd.command.replace(
          "--dangerously-skip-permissions",
          "--auto",
        ),
      };
    },
  };
}

/**
 * Fast pre-check so we don't spin up an LLM call when the backlog is empty.
 */
function hasOpenBacklogIssues(): boolean {
  try {
    const out = execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--state",
        "open",
        "--label",
        LABEL,
        "--limit",
        "1",
        "--json",
        "number",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
    const parsed = JSON.parse(out) as Array<{ number: number }>;
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    // If gh is unavailable on the host (e.g. only inside a container), fall through to planner
    return true;
  }
}

const isContainerSandbox =
  SANDBOX_MODE === "docker" || SANDBOX_MODE === "podman";

// In local/GitHub Actions mode, heavy deps are shared from the host checkout
// (same OS/arch), so worktrees only install when missing. Override contributing
// editor? No — override via FORGE_SETUP_COMMAND for non-node stacks.
const worktreeHooks: sandcastle.SandboxHooks = {
  sandbox: {
    onSandboxReady: [
      {
        command: isContainerSandbox
          ? "npm install --prefer-offline --no-audit --no-fund"
          : SETUP_COMMAND,
      },
    ],
  },
};

const headHooks: sandcastle.SandboxHooks = isContainerSandbox
  ? worktreeHooks
  : {};

const copyToWorktree = ["node_modules"];

console.log(
  `Forge starting (sandbox=${SANDBOX_MODE}, model=${MODEL}, plan=${roleModel(PLAN_MODEL)}, implement=${roleModel(IMPLEMENT_MODEL)}, review=${roleModel(REVIEW_MODEL)}, merge=${roleModel(MERGE_MODEL)}, maxIterations=${MAX_ITERATIONS}, implementMax=${IMPLEMENT_MAX_ITERATIONS}, label=${LABEL}, branchPrefix=${BRANCH_PREFIX})`,
);

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  if (!hasOpenBacklogIssues()) {
    console.log(`No open issues labeled '${LABEL}'. Exiting cleanly.`);
    break;
  }

  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    hooks: headHooks,
    sandbox: createSandboxProvider(),
    name: "planner",
    maxIterations: 1,
    agent: createAgent(roleModel(PLAN_MODEL)),
    promptFile: promptFile("plan-prompt.md"),
    promptArgs: {
      LABEL,
      BRANCH_PREFIX,
    },
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });

  const issues = plan.output.issues;

  if (issues.length === 0) {
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) to work in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  #${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review (isolated git worktree per issue)
  // -------------------------------------------------------------------------
  interface PlannedIssue {
    id: string;
    title: string;
    branch: string;
  }
  const settled = await Promise.allSettled(
    (issues as Array<PlannedIssue>).map(async (issue: PlannedIssue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: createSandboxProvider(),
        hooks: worktreeHooks,
        copyToWorktree,
      });

      try {
        const implement = await sandbox.run({
          name: `implementer-${issue.id}`,
          maxIterations: IMPLEMENT_MAX_ITERATIONS,
          agent: createAgent(roleModel(IMPLEMENT_MODEL)),
          promptFile: promptFile("implement-prompt.md"),
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        if (implement.commits.length > 0) {
          const review = await sandbox.run({
            name: `reviewer-${issue.id}`,
            maxIterations: 1,
            agent: createAgent(roleModel(REVIEW_MODEL)),
            promptFile: promptFile("review-prompt.md"),
            promptArgs: {
              BRANCH: issue.branch,
              STANDARDS_FILE,
            },
          });

          return {
            ...review,
            commits: [...implement.commits, ...review.commits],
          };
        }

        return implement;
      } finally {
        await sandbox.close();
      }
    }),
  );

  // `settled` element types come from loosely-typed agent results; keep the
  // downstream chain explicit so `strict` stays green regardless.
  type Settled = PromiseSettledResult<any>;
  const outcomes = settled as Array<Settled>;

  for (const [i, outcome] of outcomes.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ #${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  const completedIssues = outcomes
    .map((outcome: Settled, i: number) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits:`,
  );
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    console.log("No commits produced. Stopping loop.");
    break;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  // -------------------------------------------------------------------------
  await sandcastle.run({
    hooks: headHooks,
    sandbox: createSandboxProvider(),
    name: "merger",
    maxIterations: 1,
    agent: createAgent(roleModel(MERGE_MODEL)),
    promptFile: promptFile("merge-prompt.md"),
    promptArgs: {
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      ISSUES: completedIssues.map((i) => `- ${i.id}: ${i.title}`).join("\n"),
      DELIVERED_FILE,
    },
  });

  console.log("\nBranches merged.");
}

console.log("\nAll done.");
