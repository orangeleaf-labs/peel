# Peel fork

Peel is Orangeleaf's internal, desktop-only (macOS and Windows) build of
[OpenPencil](https://github.com/open-pencil/open-pencil), forked at upstream commit
`d9c0caa` (v0.16.0). This file lists every intentional divergence from upstream and why,
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
| Licensing | `NOTICE` credits OpenPencil and its contributors; `LICENSE` is unchanged. | MIT attribution must travel with the code. | setup |
| Tooling | `tools/tsconfig.json` includes `src/env.d.ts` and `packages/dom-css/src/cssom.d.ts`; three demo-tool type errors fixed. | `bun run check` failed at `check:tools` on the upstream commit; Peel needs a green local gate. | setup |
