/**
 * Every external host shipped source may name, the allow-list `hosts.test.ts` checks against.
 * Adding a host the app may contact means a `network` entry here, a row in `EGRESS.md`, and the
 * CSP `connect-src` in `desktop/tauri.conf.json` or `ALLOWED_*` in `desktop/src/egress.rs`.
 */
export type HostKind =
  /** The app, CLI, MCP server, docs site, or repository tooling may contact it; in `EGRESS.md`. */
  | 'network'
  /** Opened in the user's browser or cited in docs and comments, never fetched. */
  | 'link'
  /** Names something without contacting it: an XML namespace, schema ID, origin, or example. */
  | 'identifier'

export interface AllowedHost {
  kind: HostKind
  reason: string
}

const UPSTREAM = 'upstream link; Phase 3 rebrand removes or replaces'
const FONTS = 'Remote fonts, opt-in'

export const ALLOWED_HOSTS: Record<string, AllowedHost> = {
  'api.anthropic.com': { kind: 'network', reason: 'AI chat: the Anthropic Messages API' },
  'api.iconify.design': { kind: 'network', reason: 'Icon search and insertion' },
  'fonts.google.com': { kind: 'network', reason: `${FONTS}: Google Fonts metadata` },
  'fonts.googleapis.com': { kind: 'network', reason: `${FONTS}: Google Fonts CSS` },
  'fonts.gstatic.com': { kind: 'network', reason: `${FONTS}: Google Fonts files` },
  'api.fontsource.org': { kind: 'network', reason: `${FONTS}: Fontsource metadata` },
  'cdn.jsdelivr.net': { kind: 'network', reason: `${FONTS}: Fontsource files under /fontsource/` },
  'fonts.bunny.net': { kind: 'network', reason: `${FONTS}: Bunny Fonts` },
  'api.fontshare.com': { kind: 'network', reason: `${FONTS}: Fontshare metadata` },
  'cdn.fontshare.com': { kind: 'network', reason: `${FONTS}: Fontshare files` },
  'www.figma.com': { kind: 'network', reason: 'Figma paste: image batch lookup' },
  's3-alpha.figma.com': { kind: 'network', reason: 'Figma paste: image files' },
  's3-alpha-sig.figma.com': { kind: 'network', reason: 'Figma paste: signed image files' },
  '127.0.0.1': { kind: 'network', reason: 'Local MCP server and automation bridge' },
  'ipc.localhost': { kind: 'network', reason: 'Tauri IPC, served in process' },
  localhost: { kind: 'network', reason: 'Vite dev server in development builds only' },
  'github.com': {
    kind: 'network',
    reason: `Updater feed (Phase 4 puts it behind config); ${UPSTREAM}`
  },
  'registry.npmjs.org': {
    kind: 'network',
    reason: 'Installing the MCP companion; package release'
  },
  'api.github.com': { kind: 'network', reason: 'Docs site build and CI tooling, not the app' },
  'openpencil.dev': { kind: 'link', reason: UPSTREAM },
  'app.openpencil.dev': { kind: 'link', reason: UPSTREAM },
  'discord.gg': { kind: 'link', reason: UPSTREAM },
  'console.anthropic.com': { kind: 'link', reason: 'Where users create an Anthropic API key' },
  'nodejs.org': { kind: 'link', reason: 'Node.js download, needed for the MCP companion' },
  'developer.microsoft.com': { kind: 'link', reason: 'WebView2 runtime download' },
  'caniuse.com': { kind: 'link', reason: 'Browser support notes in browser-only banners' },
  'shaders.com': {
    kind: 'link',
    reason: 'Docs for the `shaders` library in the authoring reference'
  },
  'formulae.brew.sh': { kind: 'link', reason: 'Homebrew cask page in release docs' },
  'docs.github.com': { kind: 'link', reason: 'GitHub docs cited by CI actions' },
  'doc.rust-lang.org': { kind: 'link', reason: 'Cargo docs cited in Cargo.toml' },
  '*.openpencil.dev': { kind: 'identifier', reason: `Web origin in S3 CORS rules; ${UPSTREAM}` },
  '*.openpencil-app.pages.dev': {
    kind: 'identifier',
    reason: `Preview origin in S3 CORS rules; ${UPSTREAM}`
  },
  'tauri.localhost': { kind: 'identifier', reason: 'WebView origin the MCP server accepts' },
  'schema.tauri.app': { kind: 'identifier', reason: 'JSON schema ID in tauri.conf.json' },
  'www.speedscope.app': { kind: 'identifier', reason: 'JSON schema ID in exported frame profiles' },
  'www.w3.org': { kind: 'identifier', reason: 'SVG and XLink XML namespaces' },
  'example.com': { kind: 'identifier', reason: 'Example in comments and placeholders' }
}
