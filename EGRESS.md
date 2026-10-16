# Egress

Every network destination Peel can contact, checked against the code. Peel sends no telemetry,
usage stats, or pings; collaboration, stock photos, image generation, and non-Anthropic AI
providers are removed.

Routes:

- **CSP**: the WebView fetches the host directly; `connect-src` in `desktop/tauri.conf.json` bounds it.
- **Proxy**: the WebView asks the Rust command `proxy_http_request` (`desktop/src/http.rs`), which
  sends only to the lists in `desktop/src/egress.rs` plus storage endpoints the user approved.
- **Native**: a Tauri plugin or a spawned program, outside both.

## Desktop app

| Host                                                            | Feature                                                                                                   | Route                                                            | When                                                                                     | Source                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `api.anthropic.com`                                             | AI chat (Anthropic Messages API, the user's own key)                                                      | Proxy; CSP also allows it                                        | On use                                                                                   | `src/app/ai/chat/model.ts`                                                      |
| `api.iconify.design`                                            | Icon search and insertion, Icon layers written by AI or JSX                                               | CSP                                                              | On use                                                                                   | `packages/core/src/icons/api.ts`                                                |
| `fonts.google.com`, `fonts.googleapis.com`, `fonts.gstatic.com` | Remote fonts, Google Fonts provider                                                                       | Proxy                                                            | Off by default; on use after Settings → General → Remote fonts                           | `src/app/editor/fonts/index.ts`, `packages/core/src/text/web-font/providers.ts` |
| `api.fontsource.org`, `cdn.jsdelivr.net` (only `/fontsource/`)  | Remote fonts, Fontsource provider                                                                         | Proxy                                                            | Off by default, as above                                                                 | same                                                                            |
| `fonts.bunny.net`                                               | Remote fonts, Bunny Fonts provider                                                                        | Proxy                                                            | Off by default; after remote fonts are on, only when the user also enables this provider | same                                                                            |
| `api.fontshare.com`, `cdn.fontshare.com`                        | Remote fonts, Fontshare provider                                                                          | Proxy                                                            | Off by default, as Bunny Fonts                                                           | same                                                                            |
| `www.figma.com` (only `POST /file/<key>/image/batch`)           | Pasting Figma content with images: image lookup                                                           | Proxy                                                            | On paste from Figma                                                                      | `src/app/editor/clipboard/figma-images.ts`                                      |
| `s3-alpha.figma.com`, `s3-alpha-sig.figma.com`                  | Pasting Figma content: the image files the lookup returns                                                 | Proxy                                                            | On paste from Figma                                                                      | same                                                                            |
| User-configured                                                 | Cloud storage (S3-compatible endpoint)                                                                    | Proxy, after the user approves the endpoint in a native dialog   | On use                                                                                   | `src/app/integrations/storage/s3/fetch.ts`, `desktop/src/storage_endpoints.rs`  |
| `github.com`                                                    | Updater: `open-pencil/open-pencil/releases/latest/download/latest.json`, then the signed release it names | Native (`tauri-plugin-updater`)                                  | On launch (2.5 s after start) and from the menu                                          | `desktop/tauri.conf.json`, `src/app/shell/updater/check.ts`                     |
| `release-assets.githubusercontent.com`                          | Updater: GitHub redirects `latest.json` and the release bundles here                                      | Native (`tauri-plugin-updater`), as a redirect from `github.com` | On launch (2.5 s after start) and from the menu                                          | `desktop/tauri.conf.json`                                                       |
| `registry.npmjs.org`                                            | Installing the MCP companion `@open-pencil/mcp` with npm or Bun (`--registry=https://registry.npmjs.org`) | Native (shell plugin spawns `npm`/`bun`)                         | On use, when the user installs it                                                        | `src/app/ai/agents/native.ts`, `desktop/capabilities/default.json`              |
| `127.0.0.1`                                                     | Local MCP server and automation bridge (HTTP and WebSocket, loopback only)                                | CSP                                                              | On launch when the companion is installed                                                | `src/app/automation/mcp/spawn.ts`, `packages/mcp/src`                           |
| `ipc.localhost`                                                 | Tauri IPC between the WebView and the shell, in process                                                   | CSP                                                              | Always                                                                                   | `desktop/tauri.conf.json`                                                       |
| `localhost`                                                     | Vite dev server (`devUrl`)                                                                                | WebView                                                          | Development builds only                                                                  | `desktop/tauri.conf.json`, `vite/automation.ts`                                 |

The updater row is the upstream OpenPencil release feed, still present in this build. Phase 4
moves the update URL behind configuration and disables the updater until one is set.

The `shaders` library's ASCII and text effects try to add a Google Fonts stylesheet (`fonts.googleapis.com`) when a
shader preview plays; the desktop CSP (`style-src 'self' 'unsafe-inline'`) blocks it.

Links (`openpencil.dev`, `github.com`, `console.anthropic.com`, and others) open in the user's
browser through the opener plugin; the app never fetches them.

## CLI and MCP server

| Host                                                                                                                                                                   | Feature                                                                                                      | When   | Source                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------- |
| `127.0.0.1`                                                                                                                                                            | MCP server listens on loopback; the CLI and the server reach the running app over loopback or a local socket | On use | `packages/mcp/src/index.ts`, `packages/mcp/src/transport/discovery.ts`          |
| `api.iconify.design`                                                                                                                                                   | Icons that `eval` and headless document tools render (Iconify is the `FigmaAPI` default)                     | On use | `packages/cli/src/tool-data.ts`, `packages/core/src/icons/api.ts`               |
| `fonts.google.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, `api.fontsource.org`, `cdn.jsdelivr.net`, `fonts.bunny.net`, `api.fontshare.com`, `cdn.fontshare.com` | Font files for `export --format storybook` (on unless `--fonts none`) and HTML export with `--fonts assets`  | On use | `packages/core/src/text/web-font/assets.ts`, `packages/cli/src/commands/export` |

The MCP server relays tool calls to the app and fetches nothing itself.

## Docs site and repository tooling

Not part of the app. `api.github.com` is read when the docs site builds
(`packages/docs/.vitepress/theme/landing/download/releases.data.ts`) and by CI tooling
(`tools/ci`); `registry.npmjs.org` and `github.com` are used by release tooling (`tools/release`).

## Adding a host

A new host is one change across four places, reviewed together:

1. `connect-src` in `desktop/tauri.conf.json` if the WebView fetches it directly, or the
   `ALLOWED_*` lists in `desktop/src/egress.rs` if it goes through the proxy.
2. A row in this file.
3. A `network` entry in `tests/helpers/egress/hosts.ts`, the allow-list for hard-coded hosts.
   Links opened in the browser are `link` entries and names that are never contacted (XML
   namespaces, schema IDs, examples) are `identifier` entries; neither belongs in this file.
4. `packages/docs/overview/privacy.md` when users would notice it.

The test sees only absolute URLs written in source; a host kept as a bare string and joined into a URL at runtime is caught for the desktop WebView by the CSP and proxy checks, but not in CLI or MCP code, so review those by hand.

`tests/app/shell/egress/hosts.test.ts` fails on a hard-coded URL whose host is not in the
allow-list, and on a CSP, proxy, updater, or `network` host missing from this file.
