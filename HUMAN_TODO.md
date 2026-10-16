# Human to-do

Work that needs a person (credentials, signing material, hosting, artwork). Each item says
exactly what to do and where the result goes. Items are added as the fork progresses.

## Open

### Move the Git LFS test fixtures off `lfs.openpencil.dev`

`.lfsconfig` points Git LFS at `https://lfs.openpencil.dev`, upstream's server. The `.fig` and font
fixtures under `tests/fixtures/` (9 objects) are stored there, and 114 unit tests need them.

1. On a machine that can reach upstream's LFS server, run `git lfs fetch --all upstream`.
2. Enable Git LFS for `orangeleaf-labs/peel` on GitHub (or pick Orangeleaf's own LFS server).
3. Change `.lfsconfig` to that server (delete the file to use GitHub's), then `git lfs push --all origin`.
4. Open a PR with the `.lfsconfig` change and confirm `bun run test:unit` passes in full.

### Smoke-test the CSP on macOS and Windows

The strict CSP and the QuickJS sandbox were verified in Chromium (Linux) only; WKWebView (macOS) and WebView2 (Windows) were not run.

1. Build the desktop app (`bun run tauri build --debug`) on each platform.
2. Launch it, open a `.fig`, draw a rectangle, and edit it in the Code panel; the canvas must update.
3. Ask the AI chat to render a small frame; it must appear.
4. Open the web inspector console and confirm the only CSP report is Zod's `Function` probe (and, until Phase 2, font fetches).

### Delete merged PR branches

The agent's git proxy refuses branch deletion. Delete these merged branches on GitHub (Branches page, trash icon): `peel/phase1-ai-eval`, `peel/phase1-csp`.

### Check the filesystem allow-list on macOS and Windows

Only Linux was exercised; the macOS-only native cases were skipped.

1. Run `bun run test:native` on macOS and on Windows.
2. On an installed build: open a `.fig` through the Open dialog, quit and relaunch, and check Recent Files reopens it with a thumbnail.
3. Edit that file in another app and check Peel reloads it.
4. Save As into a new folder, export a PNG, and double-click a `.fig` in Finder or Explorer; each must work.

### Apply the pending workflow changes

The agent's GitHub token has no `workflow` scope, so it cannot change files under `.github/workflows/`. Workflow edits are saved as patches in `.github/pending-workflows/` instead.

1. From the repository root on `master`, run `git apply .github/pending-workflows/remove-telemetry.patch`. This deletes `feedback.yml`, drops the `feedback-tests` job from `ci.yml`, and removes `VITE_OPENPENCIL_FEEDBACK` from `app.yml` and `build.yml`.
2. Delete the applied patch file, and remove the `.github/workflows` exclusion in `tests/app/shell/egress.test.ts`.
3. Commit, open a PR, and confirm `bun test tests/app/shell/egress.test.ts` passes.
4. To let future agent runs change workflows directly, reconnect GitHub with the `workflow` permission at https://claude.ai/connect-github.

### Fix the Native app contracts CI job

The `Native app contracts` job in `.github/workflows/ci.yml` runs inside `ghcr.io/open-pencil/native-contracts-ci`, an upstream image this fork cannot pull ("manifest unknown"), so it fails on every PR. Build and push an equivalent image to an Orangeleaf registry and point the job's `container.image` at it, or remove the job until one exists. The agent can't make this change without `workflow` scope.

### Review the write-approval translations

The nine write-approval dialog strings in `packages/vue/src/i18n/locales/{de,es,fr,it,ja,pl,ru,zh-cn}/automation.json` were machine-written. Have a native speaker check them and open a PR with corrections.

### Check the write-approval dialog on the desktop app

1. With an MCP client connected, call `save_file` with a path; the dialog must name the tool and the file.
2. Check Allow saves, Deny and Escape save nothing, and no answer within 45 s of the call denies (a minute for the in-app AI chat).
