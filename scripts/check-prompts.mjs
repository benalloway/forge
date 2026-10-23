#!/usr/bin/env node
// Verifies every {{PLACEHOLDER}} in runner prompts is supplied by main.ts
// (promptArgs) or is a runner-library built-in. The SUPPLIED map must mirror
// the promptArgs in main.ts — update both together.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const promptsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "runner",
  "prompts",
);

// Built-ins supplied by @ai-hero/sandcastle itself (TARGET_BRANCH is the only
// one; verified against its dist: BUILT_IN_PROMPT_ARG_KEYS).
const BUILT_INS = new Set(["TARGET_BRANCH"]);

// Must match the promptArgs in main.ts per prompt file. Workflow-driven
// prompts (not rendered by main.ts) map to an EMPTY set: they must stay
// {{PLACEHOLDER}}-free and take all context via environment/files instead.
const SUPPLIED = {
  "plan-prompt.md": new Set(["LABEL", "BRANCH_PREFIX"]),
  "implement-prompt.md": new Set(["TASK_ID", "ISSUE_TITLE", "BRANCH"]),
  "review-prompt.md": new Set(["BRANCH", "STANDARDS_FILE"]),
  "merge-prompt.md": new Set(["BRANCHES", "ISSUES", "DELIVERED_FILE"]),
  "pr-review-prompt.md": new Set([]),
};

const PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
let failures = 0;
for (const file of readdirSync(promptsDir).filter((f) => f.endsWith(".md"))) {
  const supplied = SUPPLIED[file];
  if (!supplied) {
    console.error(`${file}: no promptArgs mapping — update check-prompts.mjs`);
    failures++;
    continue;
  }
  const content = readFileSync(join(promptsDir, file), "utf8");
  for (const [, key] of content.matchAll(PATTERN)) {
    if (!BUILT_INS.has(key) && !supplied.has(key)) {
      console.error(
        `${file}: {{${key}}} has no value (not a built-in, not in promptArgs)`,
      );
      failures++;
    }
  }
}

if (failures > 0) {
  process.exit(1);
}
console.log("prompt placeholders OK");
