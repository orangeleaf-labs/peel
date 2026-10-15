import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'

import * as v from 'valibot'

import { repoPath } from '#tests/helpers/paths'

const ScopeEntries = v.optional(v.array(v.object({ path: v.string() })))

const Capability = v.object({
  identifier: v.string(),
  permissions: v.array(
    v.union([
      v.string(),
      v.looseObject({ identifier: v.string(), allow: v.optional(v.array(v.unknown())) })
    ])
  )
})

const FsPermission = v.object({ identifier: v.string(), allow: ScopeEntries, deny: ScopeEntries })

type FsGrant = v.InferOutput<typeof FsPermission>

/** The folders Tauri gives the app itself; everything else must be granted by the user. */
const APP_DIRECTORIES = ['$APPDATA', '$APPLOCALDATA', '$APPCONFIG', '$APPCACHE']

/** Commands that create, change, delete, or watch files, whose scope must stay in the app's folders. */
const MUTATING = new Set([
  'fs:allow-write-file',
  'fs:allow-write-text-file',
  'fs:allow-write',
  'fs:allow-create',
  'fs:allow-truncate',
  'fs:allow-ftruncate',
  'fs:allow-rename',
  'fs:allow-copy-file',
  'fs:allow-remove',
  'fs:allow-mkdir',
  'fs:allow-watch',
  'fs:allow-open'
])

/**
 * fs permissions granted without a scope of their own. Each one either works on an already
 * opened handle or acts only on paths in the global scope or the user's dialog grants; any
 * other bare grant (such as `fs:write-all` or `fs:allow-home-write-recursive`) brings a broad
 * built-in scope with it.
 */
const BARE_FS_PERMISSIONS = new Set([
  'fs:deny-default',
  'fs:allow-fstat',
  'fs:allow-seek',
  'fs:allow-read',
  'fs:allow-watch',
  'fs:allow-unwatch'
])

function capabilities() {
  const dir = repoPath('desktop/capabilities')
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({
      name,
      capability: v.parse(
        v.pipe(v.string(), v.parseJson(), Capability),
        readFileSync(`${dir}/${name}`, 'utf8')
      )
    }))
}

function fsGrants(): { file: string; bare: string[]; scoped: FsGrant[] }[] {
  return capabilities().map(({ name, capability }) => {
    const fs = capability.permissions.filter((permission) =>
      (typeof permission === 'string' ? permission : permission.identifier).startsWith('fs:')
    )
    return {
      file: name,
      bare: fs.filter((permission) => typeof permission === 'string'),
      scoped: fs.flatMap((permission) =>
        typeof permission === 'string' ? [] : [v.parse(FsPermission, permission)]
      )
    }
  })
}

function insideAppDirectory(path: string): boolean {
  return APP_DIRECTORIES.some((dir) => path.startsWith(`${dir}/`))
}

/** A single named file, with no wildcard that could reach beyond it. */
function isExactFile(path: string): boolean {
  return !/[*?[\]{}]/.test(path)
}

describe('desktop file system scope', () => {
  test('grants no fs permission that brings its own broad scope', () => {
    const unexpected = fsGrants().flatMap(({ file, bare }) =>
      bare.filter((permission) => !BARE_FS_PERMISSIONS.has(permission)).map((p) => `${file}: ${p}`)
    )
    expect(unexpected).toEqual([])
  })

  test('allows reading only the app folders and named files', () => {
    const broad = fsGrants().flatMap(({ file, scoped }) =>
      scoped.flatMap((grant) =>
        (grant.allow ?? [])
          .filter(({ path }) => !insideAppDirectory(path) && !isExactFile(path))
          .map(({ path }) => `${file}: ${grant.identifier} ${path}`)
      )
    )
    expect(broad).toEqual([])
  })

  test('limits writing, deleting, creating folders and watching to the app folders', () => {
    const outside = fsGrants().flatMap(({ file, scoped }) =>
      scoped
        .filter((grant) => MUTATING.has(grant.identifier))
        .flatMap((grant) =>
          (grant.allow ?? [])
            .filter(({ path }) => !insideAppDirectory(path))
            .map(({ path }) => `${file}: ${grant.identifier} ${path}`)
        )
    )
    expect(outside).toEqual([])
  })

  test('deletes only inside the app cache', () => {
    const removals = fsGrants()
      .flatMap(({ scoped }) => scoped)
      .filter((grant) => grant.identifier === 'fs:allow-remove')
      .flatMap((grant) => grant.allow ?? [])
      .map(({ path }) => path)
    expect(removals).toEqual(['$APPLOCALDATA/cache', '$APPLOCALDATA/cache/**'])
  })

  test('keeps the global scope a deny list', () => {
    const global = fsGrants()
      .flatMap(({ scoped }) => scoped)
      .filter((grant) => grant.identifier === 'fs:scope')
    expect(global).toHaveLength(1)
    expect(global[0].allow ?? []).toEqual([])
    const denied = (global[0].deny ?? []).map(({ path }) => path)
    // Places where a written file would run, or the webview keeps its data.
    for (const path of [
      '$HOME/Library/LaunchAgents/**',
      '$DATA/Microsoft/Windows/Start Menu/Programs/Startup/**',
      '$DOCUMENT/PowerShell/**',
      '/usr/local/**',
      '$APPCACHE/WebKit/**'
    ]) {
      expect(denied).toContain(path)
    }
  })

  test('keeps hidden files out of every wildcard', () => {
    const config = v.parse(
      v.pipe(
        v.string(),
        v.parseJson(),
        v.object({
          plugins: v.object({ fs: v.object({ requireLiteralLeadingDot: v.literal(true) }) })
        })
      ),
      readFileSync(repoPath('desktop/tauri.conf.json'), 'utf8')
    )
    expect(config.plugins.fs.requireLiteralLeadingDot).toBe(true)
  })
})
