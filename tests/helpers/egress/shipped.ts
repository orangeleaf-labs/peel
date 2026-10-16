import { repoPath } from '#tests/helpers/paths'

/** Everything that builds into the app, the desktop shell, the docs site, or runs in CI. */
const SHIPPED_ROOTS = [
  'src',
  'vite',
  'desktop/src',
  'packages/scene-graph/src',
  'packages/pen/src',
  'packages/kiwi/src',
  'packages/fig/src',
  'packages/core/src',
  'packages/dom-css/src',
  'packages/emit/src',
  'packages/design-jsx/src',
  'packages/vue/src',
  'packages/cli/src',
  'packages/mcp/src',
  'packages/docs/.vitepress/theme',
  'packages/docs/overview',
  'skills',
  '.github',
  'tools'
]
const SHIPPED_FILES = [
  'index.html',
  'updater.html',
  'vite.config.ts',
  'package.json',
  'tsconfig.json',
  'tsconfig.tests.json',
  'desktop/tauri.conf.json',
  'desktop/Cargo.toml'
]
const SCANNED = new Bun.Glob('**/*.{ts,tsx,vue,js,mjs,json,html,css,rs,toml,yml,yaml,md}')

/** Repository-relative paths of every shipped source, config, and workflow file. */
export async function shippedFiles(): Promise<string[]> {
  const nested = await Promise.all(
    SHIPPED_ROOTS.map(async (root) =>
      (await Array.fromAsync(SCANNED.scan({ cwd: repoPath(root), dot: true })))
        .filter((file) => !/(^|\/)(node_modules|dist|cache|target)\//.test(file))
        // The agent's GitHub token cannot change `.github/workflows`; those edits wait in
        // `.github/pending-workflows/` until a person applies them (HUMAN_TODO.md).
        .filter((file) => !(root === '.github' && /^(workflows|pending-workflows)\//.test(file)))
        .map((file) => `${root}/${file}`)
    )
  )
  return [...SHIPPED_FILES, ...nested.flat()]
}
