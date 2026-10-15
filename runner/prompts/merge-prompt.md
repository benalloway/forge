# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, run the repo's own verify commands (discover
   them as the implementer does — never assume `npm`) to verify everything works
4. If verification fails, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge.

# RECORD DELIVERED ISSUES

For each branch that was successfully merged, write its issue ID (one per
line) to `{{DELIVERED_FILE}}` (create or overwrite the file). The issue IDs
are the leading numbers in this list:

{{ISSUES}}

Example file content for issues 12 and 34:

12
34

# CLOSE ISSUES (local runs only)

Check whether you are running inside GitHub Actions: `echo "$GITHUB_ACTIONS"`.

- If `GITHUB_ACTIONS` is NOT `true` (local run): close each merged issue with
  `gh issue close <ID> --comment "Completed by Forge"`. The merge is
  already on the current branch, so closing is safe.
- If `GITHUB_ACTIONS` IS `true`: do NOT close any issues. The workflow closes
  them after the push to `origin` succeeds. Closing earlier would strand the
  work (closed issue, nothing delivered) if the later verify/push steps fail.

Once you've merged everything you can, output <promise>COMPLETE</promise>.
