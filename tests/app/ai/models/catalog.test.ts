import { afterEach, describe, expect, test } from 'bun:test'

import { AI_PROVIDERS } from '@open-pencil/core/constants'

import { ANTHROPIC_MODELS, catalogModel, catalogModels } from '@/app/ai/models/catalog'

import { fetchStub } from '#tests/helpers/fetch'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('model catalog', () => {
  test('lists Anthropic models from the checked-in list without any request', () => {
    const requests: string[] = []
    globalThis.fetch = fetchStub(async (input) => {
      requests.push(String(input))
      return new Response(null, { status: 500 })
    })

    const models = catalogModels('anthropic')
    expect(models).toBe(ANTHROPIC_MODELS)
    expect(catalogModel('anthropic', models[0].id)).toBe(models[0])
    expect(requests).toEqual([])
  })

  test('offers only Claude models that can run the design tools', () => {
    expect(ANTHROPIC_MODELS.length).toBeGreaterThan(0)
    for (const model of ANTHROPIC_MODELS) {
      expect(model.id).toStartWith('claude-')
      expect(model.capabilities).toContain('tools')
    }
    expect(new Set(ANTHROPIC_MODELS.map((model) => model.id)).size).toBe(ANTHROPIC_MODELS.length)
  })

  test('includes the default Anthropic model', () => {
    const anthropic = AI_PROVIDERS.find((provider) => provider.id === 'anthropic')
    expect(catalogModel('anthropic', anthropic?.defaultModel ?? '')).not.toBeNull()
  })

  test('knows no model it was not shipped with', () => {
    expect(catalogModel('anthropic', 'gpt-6.1-sol')).toBeNull()
  })
})
