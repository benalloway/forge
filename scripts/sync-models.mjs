#!/usr/bin/env node
// Propagate runner/models.json (single source of truth) into the reusable
// workflow input defaults and the docs tables. Usage:
//   node scripts/sync-models.mjs          # rewrite in place
//   node scripts/sync-models.mjs --check  # exit 1 with drift report (CI)
// Workflow `run:` blocks are untouched — only `default:` lines and the
// marked docs blocks below.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const models = JSON.parse(
  readFileSync(join(root, "runner", "models.json"), "utf8"),
);
const KEYS = [
  "model",
  "plan_model",
  "implement_model",
  "review_model",
  "merge_model",
];
// Extra single-sourced defaults that live in models.json but are NOT
// forge.yml inputs (used by the review workflow / docs only).
const EXTRA_KEYS = ["review_fallback_model"];
for (const k of [...KEYS, ...EXTRA_KEYS]) {
  if (typeof models[k] !== "string" || models[k].length === 0) {
    console.error(`models.json: missing or empty "${k}"`);
    process.exit(1);
  }
}

// --- YAML input defaults -------------------------------------------------
// For each [yamlKey, modelKey]: matches `  yamlKey:` … (≤6 lines) …
// `default: "old"` and swaps in models[modelKey]. (The review workflow's
// `model` input tracks the `review_model` lineup entry.)
function syncYaml(path, pairs) {
  let text = readFileSync(path, "utf8");
  let changed = 0;
  for (const [yamlKey, modelKey] of pairs) {
    const re = new RegExp(
      `(^\\s*${yamlKey}:\\n(?:.*\\n){1,6}?\\s*default: ")[^"]*(")`,
      "m",
    );
    if (!re.test(text)) {
      console.error(`${path}: input \`${yamlKey}\` default not found`);
      process.exit(1);
    }
    const next = text.replace(re, `$1${models[modelKey]}$2`);
    if (next !== text) changed++;
    text = next;
  }
  return { text, changed };
}

// --- Marked docs blocks ----------------------------------------------------
// <!-- MODELS:<tag>:BEGIN --> … <!-- MODELS:<tag>:END --> replaced wholesale.
function blockRow(key, value, note) {
  return `| \`${key}\` | \`${value}\` | ${note} |`;
}
const BLOCKS = {
  factory: [
    blockRow(
      "model",
      models.model,
      "Global default; blank role values inherit it. Free tier, zero-retention — free IDs rotate, see Troubleshooting in INSTALL.md.",
    ),
    blockRow(
      "plan_model",
      models.plan_model,
      "Planner (reasons once per cycle). Contributor tier: prompts may train future models, geo-limited — swap for a zero-retention model in private repos. Same `OPENCODE_API_KEY` authorizes it (same Console account).",
    ),
    blockRow("implement_model", models.implement_model, "Implementer (dominates cost)."),
    blockRow("review_model", models.review_model, "In-branch reviewer ($0.10/M in)."),
    blockRow("merge_model", models.merge_model, "Merger."),
  ].join("\n"),
  review: [
    blockRow(
      "model",
      models.review_model,
      "Any OpenCode model ID. PR review is a single careful read — cheap + reliable beats free here (~1¢/review).",
    ),
    blockRow(
      "fallback_model",
      models.review_fallback_model,
      "Free-tier retry when the primary fails (budget exhausted, model retired, transient 5xx). Same free default as the factory global.",
    ),
  ].join("\n"),
};

function syncDocs(path) {
  let text = readFileSync(path, "utf8");
  let changed = 0;
  for (const [tag, body] of Object.entries(BLOCKS)) {
    const re = new RegExp(
      `(<!-- MODELS:${tag}:BEGIN -->\n)[\\s\\S]*?(\n<!-- MODELS:${tag}:END -->)`,
    );
    if (!re.test(text)) {
      console.error(`${path}: MODELS:${tag} block markers not found`);
      process.exit(1);
    }
    const next = text.replace(re, `$1${body}$2`);
    if (next !== text) changed++;
    text = next;
  }
  return { text, changed };
}

const jobs = [
  { path: join(root, ".github", "workflows", "forge.yml"), fn: () => syncYaml(join(root, ".github", "workflows", "forge.yml"), KEYS.map((k) => [k, k])) },
  { path: join(root, ".github", "workflows", "review.yml"), fn: () => syncYaml(join(root, ".github", "workflows", "review.yml"), [["model", "review_model"], ["fallback_model", "review_fallback_model"]]) },
  { path: join(root, "docs", "CONFIGURATION.md"), fn: () => syncDocs(join(root, "docs", "CONFIGURATION.md")) },
];

let drift = 0;
for (const { path, fn } of jobs) {
  const { text, changed } = fn();
  if (!changed) continue;
  drift++;
  if (CHECK) {
    console.error(`drift: ${path} does not match runner/models.json`);
  } else {
    writeFileSync(path, text);
    console.log(`synced: ${path}`);
  }
}
if (CHECK && drift > 0) {
  console.error("Run `node scripts/sync-models.mjs` and commit the result.");
  process.exit(1);
}
if (!CHECK && drift === 0) console.log("models already in sync.");
