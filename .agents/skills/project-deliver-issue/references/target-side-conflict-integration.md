# Target-side conflict integration

Use only for an existing GitLab MR targeting `deploy/dev` when GitLab reports a
merge conflict and the user explicitly opts into local target-side preparation
for that MR. Ordinary issue delivery follows [the branching strategy](branching-strategy.md).

Keep the feature branch's pinned production root, dependency ancestry, commits,
and HEAD unchanged. Integrate only in a disposable local worktree based on the
current remote `deploy/dev` tip. Leave the feature branch unmerged and unrebased, and keep the shared `deploy/dev` checkout out of this procedure.

## 1. Require evidence before local integration

Record and verify all of the following before creating the worktree or merging:

- The explicit opt-in, MR URL/IID, source and target projects/branches, open MR
  state, and fresh GitLab conflict evidence. Wait for a definitive result; a pending mergeability calculation
  or another merge blocker is not conflict evidence.
- The issue contract and accepted comments, recorded production tag/full SHA,
  feature base, ordered dependency SHAs, and the reviewed feature patch and
  delivery verification. Confirm that the pinned ancestry still holds.
- Freshly fetched full source and target SHAs, matching the MR source HEAD and
  target `deploy/dev`. Record the feature HEAD separately and require it to
  equal the fetched MR source SHA; stop on unpublished or mismatched source work.
- Any additional review explicitly required by the issue is complete, with its result and
  reviewed revision recorded. Resolve its findings or record an explicitly
  accepted disposition. Missing, pending, or stale reviews block integration.
  Code review is the final review step; only a code review run last satisfies that gate.

This exception does not cover a dependency-target MR, production promotion, or
an extra `feature/harness` target. Report an unmet gate without changing refs.

## 2. Resolve and verify locally

1. Create a uniquely named disposable branch and worktree from the recorded
   target SHA, for example `codex/mr-<iid>-dev-integration`. Require a clean
   checkout with HEAD equal to that SHA. Leave existing worktrees as they are.
2. In that worktree, run `git merge --no-ff --no-commit <source-sha>` using the
   recorded MR source SHA. Resolve conflicts against both the accepted issue
   contract and current target behavior. Inspect each conflicted path and the
   complete staged delta from the target to verify each resolution against those
   contracts. Stop for a human decision if resolution requires a behavior or scope
   decision outside the accepted contract.
3. Require no unmerged index entries (`git ls-files -u`), no remaining conflict
   markers in the changed content, and a passing `git diff --cached --check`.
   Record each resolution and its rationale. Run the applicable repository
   checks and issue acceptance verification on the combined tree, including
   affected journeys or visual states when required. Keep actual commands and
   results from the combined tree.
4. Repeat any additional required review invalidated by the resolutions. Require
   all such reviews and integration checks to pass before proceeding. If work
   cannot be completed, report the blocker and local worktree state; publish
   nothing. Abort only the merge in this disposable worktree when abandoning it.
5. Commit the verified merge locally with `git commit --no-edit`, retaining
   Git's stock merge subject. Put any extra context after a blank line in its
   body. Require exactly two parents: the recorded target SHA first and source
   SHA second. Record the merge SHA and tree, confirm a clean checkout, and
   recheck that the feature HEAD and its pinned ancestry remain unchanged.

## 3. Code review is the final review

Use the isolated review dispatch and repeat-until-pass gate from
[full-issue review](04_review.md#full-issue-review) after conflict resolution,
verification, and any additional required reviews. Corrections here follow the
local merge procedure below, preserving the two-parent merge commit.
Use the recorded target SHA as base and local merge SHA as reviewed revision.
Supply the issue contract, pinned source patch, both parent SHAs,
resolution rationale, verification evidence, and local merge SHA. Review the
complete target-to-merge delta and conflict resolutions.

Resolve code-review findings locally. Any edits require renewed verification
and any affected non-code reviews, then a final code review of the resulting
commit. Preserve the two-parent merge and stock subject when amending. Proceed
only with a clean, verified merge revision and no unresolved review findings.

Report the local branch/worktree, unchanged feature HEAD, target/source/merge
SHAs, resolution summary, checks and review outcomes, and exact proposed remote
ref update. Stop here unless publication of this target-side merge is explicitly
authorized for `deploy/dev`.

## 4. Publish only with explicit target-update authorization

Explain the effect before obtaining authorization for the concrete merge SHA
and destination: pushing this target-side merge updates `deploy/dev` and causes
GitLab to recognize the MR as merged (normally `merged manually`), completing
the merge outside the MR's Merge button. See
[GitLab's merge-status documentation](https://docs.gitlab.com/user/project/merge_requests/merge_request_troubleshooting/#merged-outside-the-gitlab-ui).
This update can trigger target-branch pipelines and deployment. Preserve project
approval, CI, and protected-branch requirements.

Immediately before an authorized push, fetch again and re-read the MR. Require
the same open MR, source SHA, target branch and target SHA, plus the reviewed
local merge SHA and clean checkout. If either remote tip changed, stop and
rebuild from fresh evidence in a new disposable worktree, repeat verification
and reviews, and obtain authorization for the replacement merge. Salvaging a stale integration by force
push or rewriting the feature is off limits.

Push only the reviewed merge SHA to `refs/heads/deploy/dev` on the verified
target-project remote using a normal fast-forward push. On rejection, retain
branch protection and report the blocker. Then read back the remote
target ancestry and GitLab MR state to confirm that the recorded source and
merge are present and the MR is merged. Report pipeline/deployment status
separately using their own observed results. If GitLab has not recognized the
merge, report the discrepancy.
