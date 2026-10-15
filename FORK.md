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
