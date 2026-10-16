import { afterEach, describe, expect, test } from 'bun:test'

import { DEFAULT_WEB_FONT_PROVIDER_SETTINGS, FontManager } from '@open-pencil/core/text'

import { onlineFontProviders, onlineFontsEnabled } from '@/app/editor/fonts'
import { optInFontFetch } from '@/app/editor/fonts/remote'

import { fetchStub } from '#tests/helpers/fetch'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function recordRequests() {
  const urls: string[] = []
  const record = async (input: string | URL | Request) => {
    urls.push(input instanceof Request ? input.url : String(input))
    return new Response('{}', { status: 200 })
  }
  globalThis.fetch = fetchStub(record)
  return { urls, record }
}

describe('remote fonts preference', () => {
  test('is off by default, so the app enables no online font provider', () => {
    // Other suites share the process-wide `fontManager`, so check the default it is fed and a
    // fresh manager rather than the singleton's current state.
    expect(onlineFontsEnabled.value).toBe(false)
    const manager = new FontManager()
    manager.setOnlineFontProviders(
      onlineFontProviders(onlineFontsEnabled.value, DEFAULT_WEB_FONT_PROVIDER_SETTINGS, true)
    )
    expect(new FontManager().enabledOnlineFontProviders()).toEqual([])
    expect(manager.enabledOnlineFontProviders()).toEqual([])
  })

  test('the font loader makes no network request while it is off', async () => {
    const network = recordRequests()
    const manager = new FontManager()
    manager.setOnlineFontProviders(
      onlineFontProviders(false, DEFAULT_WEB_FONT_PROVIDER_SETTINGS, true)
    )
    manager.setWebFontFetch(optInFontFetch(() => false, network.record))

    expect(await manager.loadFont('Peel Missing Family', 'Bold', 'Ab')).toBeNull()
    await manager.ensureFallbackPack(['cjk'], '字')
    const families = await manager.listFamilyOptions()

    expect(network.urls).toEqual([])
    expect(families.map((family) => family.source)).toEqual(['bundled'])
  })

  test('selects the chosen providers once it is on', () => {
    expect(onlineFontProviders(true, DEFAULT_WEB_FONT_PROVIDER_SETTINGS, true)).toEqual({
      google: true,
      fontsource: true,
      bunny: false,
      fontshare: false
    })
  })

  test('passes requests through once the user turns it on', async () => {
    const network = recordRequests()
    let enabled = false
    const fontFetch = optInFontFetch(() => enabled, network.record)

    await expect(fontFetch('https://fonts.gstatic.com/font.ttf')).rejects.toThrow(
      'Remote fonts are turned off'
    )
    enabled = true
    await fontFetch('https://fonts.gstatic.com/font.ttf')

    expect(network.urls).toEqual(['https://fonts.gstatic.com/font.ttf'])
  })
})
