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
| Design JSX runs in QuickJS-WASM (`quickjs-emscripten-core` and `@jitl/quickjs-singlefile-mjs-release-sync`, MIT, pinned 0.32.0) with 2 s, 64 MB and 1 MB stack limits. | A strict CSP without `unsafe-eval` needs an evaluator that only requires `wasm-unsafe-eval`; it is also a stronger isolation boundary than `new Function`. |
| `style-src` keeps `'unsafe-inline'` and is excluded from Tauri's nonce injection (`dangerousDisableAssetCspModification: ["style-src"]`). | Vue, Reka UI and Tailwind set inline styles at runtime; a nonce would make the browser ignore `'unsafe-inline'`. Styles cannot run script. |
| Zod's `new Function('')` capability probe is left to fail under the CSP. | Zod catches it and falls back to its non-JIT parser; the only effect is one CSP report at startup. |
| The automation bridge `eval` command stays behind MCP `allowEval: false` and is inert under the CSP. | It ran in the window with `new Function`; making it work would need `unsafe-eval`. |
| Remote branches are left for a person to delete when the agent environment's git proxy refuses `git push --delete`. | The GitHub API used here has no branch-delete call; merged PR branches are harmless and listed in HUMAN_TODO.md. |
| Document access persists through `tauri-plugin-persisted-scope`. | It is Tauri v2's own way to keep dialog and OS-granted paths across restarts, so recent files, thumbnails and reopen work without a broad scope. |
| The WebView's only app folder is `$APPLOCALDATA/cache` (read, write, mkdir, remove). | It is the only app folder the code uses; the other app folders hold the WebView2 profile (`EBWebView`) and WebKit data, which injected script must not rewrite. |
| Automation open/save outside the user's grants fails rather than prompting to widen the scope, so an MCP or CLI client cannot `save_file` or `new_document` into the MCP root unless the user saved that exact file in the app. | Safer and reversible; the user opens or saves the file once in the app to grant it. |
| `$APPCACHE/WebKit` and `$APPLOCALDATA/EBWebView` are denied globally. | WKWebView and WebView2 keep their data there; the deny keeps a later widening of the allow-list from reaching them. |
| AI writes are approved per call; there is no "allow for this session". | Safer default; nothing is remembered that the user cannot see. |
| No answer to a write approval within 60 s counts as Deny. | Matches the ACP permission timeout; an unattended app never writes. |
| Network-only tools (icons, stock photos, vision) do not ask for write approval. | They read, not write; egress is handled in Phase 2. |
| AI connections saved for a removed provider are dropped when settings load; their old keys are not deleted from the keychain. | Peel never reads them; deleting could affect a co-installed upstream OpenPencil. |
| The model list is checked in rather than fetched. | No runtime call to models.dev; new Claude models arrive with an app update. |
| Plaintext localStorage keys for removed AI providers are deleted at startup, not migrated. | No plaintext secret outlives its provider; upstream's own migration already deletes these entries. |
| Stored Recraft and fal.ai keys are not deleted from the keychain. | Peel never reads them; deleting could affect a co-installed upstream OpenPencil. |
