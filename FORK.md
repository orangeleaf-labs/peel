# Peel fork

Peel is Orangeleaf's internal, desktop-only (macOS and Windows) build of
[OpenPencil](https://github.com/open-pencil/open-pencil), forked at upstream commit
`d9c0caa` (8 commits after the `v0.16.0` tag). This file lists every intentional divergence from upstream and why,
so each one can be re-checked when we rebase. Decisions behind them are in
[`DECISIONS.md`](DECISIONS.md); work only a human can do is in [`HUMAN_TODO.md`](HUMAN_TODO.md).

## Remotes

```sh
git remote add upstream https://github.com/open-pencil/open-pencil.git
git fetch upstream
```

## Divergences

Each row names the area, what Peel does differently, why, and the PR that introduced it.

| Area | Divergence | Why | PR |
| ---- | ---------- | --- | -- |
| Licensing | `NOTICE` credits OpenPencil and its contributors; `LICENSE` is unchanged. | MIT attribution must travel with the code. | #1 |
| Tooling | `tools/tsconfig.json` includes `src/env.d.ts` and `packages/dom-css/src/cssom.d.ts`; three demo-tool type errors fixed. | `bun run check` failed at `check:tools` on the upstream commit; Peel needs a green local gate. | #1 |
| App telemetry | `src/app/telemetry/instance.ts` types its response helper as `Promise<{ ok: boolean }>` instead of `Promise<Response>`. | The `check:tools` typecheck rejected the Hono client response type; telemetry itself is removed in Phase 2. | #1 |
| AI chat tools | `eval` is hidden from the in-app AI chat (`exposure.ai: false`) and the chat catalog drops any `code:execute` tool; the chat system prompt no longer mentions `eval`. | Chat ran model-written JavaScript in the main window with no approval (Phase 1 audit finding 1). | #2 |
| Content security policy | `desktop/tauri.conf.json` sets a strict CSP (`default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, no `unsafe-eval`, `connect-src` limited to IPC, the local MCP/automation ports, Anthropic and Iconify) instead of `csp: null`. | Without a CSP any injected script could load code or send data anywhere (Phase 1 audit finding 2). | #3 |
| Design JSX evaluation | Design JSX from the AI `render`/`replace`/diff tools and the Code panel runs in QuickJS compiled to WebAssembly (`src/app/code/sandbox/`), through a pluggable evaluator in `@open-pencil/design-jsx`, instead of `new Function` in the window or a sandboxed iframe. | The CSP forbids `eval`; QuickJS also gives model-written JSX no DOM, network, IPC or editor objects. | #3 |
| Desktop fs scope | The fs capability is an allow-list (the app cache `$APPLOCALDATA/cache`, plus files the user picks or opens from the OS), and the webview profile folders are denied; `tauri-plugin-persisted-scope` keeps those grants across restarts. Upstream grants read, write, remove, mkdir and watch on `**` with a deny list. | A WebView compromise must not read or replace arbitrary user files (Phase 1 audit finding 3). | #4 |
| Automation file paths | MCP/CLI `open_file`, `save_file` and `new_document` with a path outside the user's grants fail with an explanatory error, and the bridge no longer creates parent folders. | Under the allow-list the app must not widen its scope for an AI client. | #4 |
| MCP root picker | The MCP root folder is picked through a Rust command (`pick_mcp_root_folder`) instead of the JS dialog, so the folder is not added to the WebView's fs scope. | The root is used only by the MCP server process; a persisted grant would defeat the allow-list. | #4 |
| AI write approval | A shared write-approval queue (`src/app/automation/write-approval/`) and an in-app Allow/Deny dialog; the AI chat asks before any tool that declares `filesystem:write` or `settings:write`. Deny, or no answer within 60 s, fails the call. | Phase 1 audit finding 4: AI tool calls must not write outside the document unapproved. | #5 |
| AI providers | Anthropic API only, with a checked-in model list (`src/app/ai/models/catalog/index.ts`); OpenAI, OpenRouter (and its OAuth sign-in), Google, DeepSeek, Z.ai, MiniMax, custom and local endpoints and the models.dev catalog are removed. On desktop the key is kept only in the OS keychain. | Phase 2 egress: one provider, key in the OS keychain. | #10 |
| Image vectorization | The Recraft and fal.ai image-to-vector action, its settings and its keys are removed; the core SVG-to-vector conversion stays for SVG import. | Phase 2 egress: these services received user images and are not Anthropic. | #11 |
