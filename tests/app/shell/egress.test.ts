import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

import * as v from 'valibot'

import { repoPath } from '#tests/helpers/paths'

/**
 * Hosts and switches of the removed telemetry and Cloud waitlist: the feedback service (daily
 * ping, usage stats, waitlist), the PostHog analytics it proxied to, and the Turnstile bot check.
 */
const REMOVED_EGRESS = [
  'feedback.openpencil.dev',
  'challenges.cloudflare.com',
  'posthog',
  'VITE_OPENPENCIL_FEEDBACK',
  'OPENPENCIL_TELEMETRY',
  'sharing_disabled_by_env',
  '@open-pencil/feedback'
]

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

async function shippedFiles(): Promise<string[]> {
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

const WorkspaceManifest = v.object({
  workspaces: v.optional(v.array(v.string())),
  dependencies: v.optional(v.record(v.string(), v.string())),
  devDependencies: v.optional(v.record(v.string(), v.string()))
})

async function readManifest(path: string) {
  const text = await readFile(repoPath(path), 'utf8')
  return v.parse(v.pipe(v.string(), v.parseJson(), WorkspaceManifest), text)
}

describe('removed telemetry egress', () => {
  test('no shipped source, config, or workflow names a removed host or switch', async () => {
    const files = await shippedFiles()
    expect(files.length).toBeGreaterThan(1000)
    const hits: string[] = []
    for (const file of files) {
      const text = await readFile(repoPath(file), 'utf8')
      for (const needle of REMOVED_EGRESS) {
        if (text.includes(needle)) hits.push(`${file}: ${needle}`)
      }
    }
    expect(hits).toEqual([])
  })

  test('the feedback Worker is not part of the workspace and nothing depends on it', async () => {
    expect(existsSync(repoPath('packages/feedback/package.json'))).toBe(false)
    const root = await readManifest('package.json')
    expect(root.workspaces).not.toContain('packages/feedback')
    for (const path of root.workspaces ?? []) {
      const manifest = await readManifest(`${path}/package.json`)
      expect(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })).not.toContain(
        '@open-pencil/feedback'
      )
    }
  })
})
