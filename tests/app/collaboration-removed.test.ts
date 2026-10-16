import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

import * as v from 'valibot'

import { parseAppRuntimeConfig } from '@/app/runtime/config'
import { APP_MENU_APP_ITEMS, APP_MENU_SCHEMA, type AppMenuEntry } from '@/app/shell/menu/schema'

import { repoPath } from '#tests/helpers/paths'

/**
 * Collaboration is disabled in Peel: no rooms, share links, voice, or peer-to-peer transport.
 * These guard that nothing brings the transport or its signalling back.
 */

/** Packages that exist only to sync rooms or reach their signalling servers. */
const COLLAB_PACKAGE = /^(@trystero-p2p\/.+|trystero|yjs|y-protocols|y-indexeddb|y-webrtc|lib0)$/

/** Hosts the removed transport reached: MQTT brokers, STUN and TURN servers. */
const SIGNALLING_HOSTS = [
  'openrelay.metered.ca',
  'stun.l.google.com',
  'stun.cloudflare.com',
  'broker.emqx.io',
  'broker.hivemq.com',
  'test.mosquitto.org',
  'tracker.openwebtorrent.com',
  'tracker.webtorrent.dev'
]

const manifestSchema = v.object({
  dependencies: v.optional(v.record(v.string(), v.string()), {}),
  devDependencies: v.optional(v.record(v.string(), v.string()), {}),
  optionalDependencies: v.optional(v.record(v.string(), v.string()), {}),
  peerDependencies: v.optional(v.record(v.string(), v.string()), {})
})

async function dependencyNames(manifestPath: string): Promise<string[]> {
  const text = await readFile(repoPath(manifestPath), 'utf8')
  const result = v.safeParse(v.pipe(v.string(), v.parseJson(), manifestSchema), text)
  if (!result.success) throw new Error(`Unreadable manifest: ${manifestPath}`)
  const { dependencies, devDependencies, optionalDependencies, peerDependencies } = result.output
  return Object.keys({
    ...dependencies,
    ...devDependencies,
    ...optionalDependencies,
    ...peerDependencies
  })
}

async function workspaceManifests(): Promise<string[]> {
  const manifests = ['package.json']
  for await (const path of new Bun.Glob('packages/*/package.json').scan(repoPath())) {
    manifests.push(path)
  }
  return manifests
}

async function shippedSources(): Promise<Array<{ path: string; text: string }>> {
  const files: Array<{ path: string; text: string }> = []
  for (const pattern of [
    'src/**/*.{ts,vue}',
    'packages/*/src/**/*.{ts,vue}',
    'desktop/src/**/*.rs'
  ]) {
    for await (const path of new Bun.Glob(pattern).scan(repoPath())) {
      files.push({ path, text: await readFile(repoPath(path), 'utf8') })
    }
  }
  return files
}

function menuIds(entries: readonly AppMenuEntry[]): string[] {
  return entries.flatMap((entry) =>
    entry.type === 'separator' ? [] : [entry.id, ...menuIds(entry.sub ?? [])]
  )
}

describe('collaboration is removed', () => {
  test('no workspace depends on the peer-to-peer transport or its document sync', async () => {
    for (const manifest of await workspaceManifests()) {
      const names = await dependencyNames(manifest)
      expect({ manifest, collab: names.filter((name) => COLLAB_PACKAGE.test(name)) }).toEqual({
        manifest,
        collab: []
      })
    }
  })

  test('the lockfile installs none of them', async () => {
    const lock = await readFile(repoPath('bun.lock'), 'utf8')
    expect(lock).not.toMatch(
      /"(@trystero-p2p\/[^"]+|trystero|yjs|y-protocols|y-indexeddb|y-webrtc|lib0)"/
    )
  })

  test('no shipped module imports them or names a signalling host', async () => {
    const offending = (await shippedSources()).flatMap(({ path, text }) => [
      // `from 'x'`, `import('x')`, and a side-effect `import 'x'`.
      ...[...text.matchAll(/(?:\bfrom|\bimport\s*\(?)\s*['"]([^'"]+)['"]/g)]
        .map((match) => match[1] ?? '')
        .filter((specifier) =>
          COLLAB_PACKAGE.test(
            specifier
              .split('/')
              .slice(0, specifier.startsWith('@') ? 2 : 1)
              .join('/')
          )
        )
        .map((specifier) => `${path}: imports ${specifier}`),
      ...SIGNALLING_HOSTS.filter((host) => text.includes(host)).map((host) => `${path}: ${host}`)
    ])
    expect(offending).toEqual([])
  })

  test('the app opens no peer-to-peer connection', async () => {
    const offending = (await shippedSources())
      .filter(({ path }) => path.startsWith('src/'))
      .flatMap(({ path, text }) =>
        ['RTCPeerConnection', 'iceServers']
          .filter((name) => text.includes(name))
          .map((name) => `${path}: ${name}`)
      )
    expect(offending).toEqual([])
  })

  test('no menu entry shares, joins, or calls', () => {
    const ids = [
      ...APP_MENU_SCHEMA.flatMap((group) => menuIds(group.items)),
      ...menuIds(APP_MENU_APP_ITEMS)
    ]
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.filter((id) => /share|collab|room|join|voice|call/i.test(id))).toEqual([])
  })

  test('runtime flags cannot choose a collaboration transport or relay', () => {
    const config = parseAppRuntimeConfig('?test&collabTransport=test&collabRelay=ws%3A%2F%2Fx')
    expect(Object.keys(config).filter((key) => /collab/i.test(key))).toEqual([])
  })
})
