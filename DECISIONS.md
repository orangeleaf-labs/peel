# Decisions

Choices made while forking OpenPencil into Peel, one line of reasoning each. When a request
did not cover a case, the safer and more reversible option was taken.

| Decision | Reason |
| -------- | ------ |
| AI provider: Anthropic API only, key stored in the OS keychain. | Default given in the brief; one vetted provider and no plaintext keys. |
| Collaboration: disabled entirely. | Default given in the brief; peer-to-peer sync needs signalling hosts and is out of scope for an internal desktop tool. |
| Updater: disabled until an update URL and public key are configured. | No hosting exists yet; the code path stays behind config. |
| The repository's default branch is `master`, and every "main" in the brief means `master`. | The fork kept upstream's branch name; renaming it would break upstream rebases. |
| PRs are opened, reviewed and merged through the GitHub API rather than `gh`, from one account. | `gh` is not authenticated in the agent environment; the API performs the same operations. |
| The orchestrator agent applies reviewer findings itself (the fixer role); the reviewer is always a fresh agent that did not write the code. | Independence matters for the review, not the fix; each re-review is still done by a separate agent. |
| Reviewer verdicts are posted as PR reviews by a separate reviewer agent; when GitHub refuses a self-approval, the verdict is a `COMMENT` review whose first line is `Verdict: APPROVE` or `Verdict: REQUEST_CHANGES`. | One GitHub account opens and reviews the PRs, and GitHub does not let an author approve their own PR. |
| While the fork has no GitHub Actions runs, "CI green" means `bun run check` and `bun run test:unit` passing locally on the PR head. | The fork had zero registered workflows at the start of the run; once checks report on PRs they are waited on as well. |
| The first PR uses the branch `peel/phase1-setup-mukcuw`. | That branch was pre-created for this run and fits the `peel/<phase>-<topic>` naming. |
| `bun run check` failing at `check:tools` on the upstream commit is fixed in the setup PR rather than ignored. | Every later PR is verified with that gate, so it has to start green. |
| The unit-test gate is "no failures beyond the upstream baseline": 114 tests fail on the untouched fork because their Git LFS fixtures live on `lfs.openpencil.dev`, which the agent environment cannot reach. | The failures need the `.fig` fixtures, not code changes; a PR may not add a failure to that list. |
| In-app AI chat never offers a tool with the `code:execute` capability (today only `eval`), even if a saved setting enables it. | Model-written scripts run with the editor's privileges; MCP keeps `eval` behind `allowEval: false`. |
