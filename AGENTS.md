# AGENTS.md — ground rules for AI agents working in `benalloway/forge`

Forge is shared infrastructure: every consumer repo vendors it and pins a
version. Treat every change here as a downstream release.

## Source of truth

- `README.md` — what Forge is, consumer contract, versioning rules.
- `docs/INSTALL.md` — agent-executable install guide (keep it literally
  runnable; every command copy-pasteable, no placeholders left unexplained).
- `docs/CONFIGURATION.md` — every input/env var. Adding a knob? Document it
  here in the same change.
- `CHANGES.md` — one entry per behavior change (Change / Consumer impact /
  Rollback), newest first.

## Invariants (do not violate)

- **Generic across stacks.** Never hardcode a language, package manager, or
  framework in `runner/` or the reusable workflow. Repo-specific behavior
  enters through `FORGE_*` env / workflow inputs with working defaults, or is
  discovered at runtime (agents read the consumer's `package.json`,
  `AGENTS.md`, etc.).
- **Backwards compatible within a major.** No renames/removals of workflow
  inputs, `FORGE_*` variables, prompt `{{PLACEHOLDERS}}`, or vendored paths.
  Additive only until `v2`.
- **Issues close only after delivery.** The merger never closes issues on
  GitHub Actions runs; the workflow closes (push mode) or links (PR mode)
  after the push succeeds. A failed run must leave issues open for retry.
- **`.sandcastle/` is lib state.** The underlying runner library hardcodes
  `.sandcastle/worktrees` (+ logs/patches). Never fight that path; Forge
  config lives in `.forge/`, standards path stays configurable.
- Small commits, imperative messages. `npm run check` green before finishing
  (see `runner/package.json`).

## Commands

```sh
npm run check --prefix runner   # tsc --noEmit + prompt-placeholder coverage — feedback loop before every commit
```
