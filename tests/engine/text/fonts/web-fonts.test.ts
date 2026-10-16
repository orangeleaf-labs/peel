import { describe, expect, test } from 'bun:test'

import {
  FontManager,
  normalizedCoverageText,
  WebFontResolver,
  webFontSubsetsForText
} from '@open-pencil/core/text'

import { fetchStub } from '#tests/helpers/fetch'

describe('online font providers', () => {
  test('stay off until the host enables them, so a missing font needs no network', async () => {
    const manager = new FontManager()
    const urls: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchStub(async (input) => {
      urls.push(String(input))
      return new Response('{}', { status: 200 })
    })
    try {
      expect(new WebFontResolver().enabledProviders()).toEqual([])
      expect(manager.enabledOnlineFontProviders()).toEqual([])
      expect(await manager.loadFont('Peel Missing Family', 'Regular', 'Ab')).toBeNull()
      expect(urls).toEqual([])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('web font coverage requests', () => {
  test('normalizes coverage without splitting supplementary code points', () => {
    expect(normalizedCoverageText('界A界𠀀A')).toBe(normalizedCoverageText('A界𠀀'))
    expect(Array.from(normalizedCoverageText('𠀀'))).toEqual(['𠀀'])
  })

  test('aborts a font load queued behind an active provider request', async () => {
    const resolver = new WebFontResolver()
    resolver.setEnabled({ google: true })
    const started = Promise.withResolvers<undefined>()
    const blocked = Promise.withResolvers<Response>()
    resolver.setRemoteFetch(async () => {
      started.resolve(undefined)
      return blocked.promise
    })
    const first = resolver.listFamilies('google')
    await started.promise
    const abort = new AbortController()
    const queued = resolver.fetchFont(['Inter'], 'Regular', '', abort.signal)

    abort.abort()

    await expect(queued).rejects.toHaveProperty('name', 'AbortError')
    blocked.resolve(new Response('{}', { status: 200 }))
    await first
  })

  test('aborts promptly while provider resolution is pending', async () => {
    const resolver = new WebFontResolver()
    resolver.setEnabled({ google: true })
    const started = Promise.withResolvers<undefined>()
    const blocked = Promise.withResolvers<Response>()
    resolver.setRemoteFetch(async () => {
      started.resolve(undefined)
      return blocked.promise
    })
    const abort = new AbortController()
    const loading = resolver.fetchFont(['Inter'], 'Regular', '', abort.signal)
    await started.promise

    abort.abort()

    await expect(loading).rejects.toHaveProperty('name', 'AbortError')
    blocked.resolve(new Response('{}', { status: 200 }))
  })

  test('requests script-specific subsets instead of Latin only', () => {
    expect(webFontSubsetsForText('مرحبا')).toContain('arabic')
    expect(webFontSubsetsForText('한글')).toContain('korean')
    expect(webFontSubsetsForText('かな')).toContain('japanese')
    expect(webFontSubsetsForText('你好')).toEqual(
      expect.arrayContaining(['chinese-simplified', 'chinese-traditional', 'japanese'])
    )
  })
})
