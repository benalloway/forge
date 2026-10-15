# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `gh issue view <ID>`. If it has a parent PRD, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task. Start with the repo's own
conventions (`AGENTS.md`, `CONTRIBUTING.md`, docs, ADRs/glossary if present) —
domain vocabulary and architecture decisions live there, not in these prompts.

Pay extra attention to test files that touch the relevant parts of the code.
If the repo has no test suite, say so early and verify with its build/typecheck
instead — never invent a test framework for the repo.

# EXECUTION

If applicable, use RGR to complete the task.

1. RED: write one test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

# FEEDBACK LOOPS

This prompt is stack-agnostic on purpose. Before committing, discover this
repo's verify commands — `package.json` scripts, `AGENTS.md`/`CONTRIBUTING.md`,
Makefile/CI config, or equivalent — and run the appropriate ones until green
(examples: `npm run check` + `npm run build`, `npm run typecheck` +
`npm run test`, `cargo test`, `go test ./...`). Never weaken types or config
to silence errors.

# COMMIT

Make a git commit. The commit message must:

1. Start with `FORGE:` prefix
2. Include task completed + PRD reference
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
