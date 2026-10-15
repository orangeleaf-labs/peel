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

The agent's git proxy refuses branch deletion. Delete these merged branches on GitHub (Branches page, trash icon): `peel/phase1-ai-eval`.
