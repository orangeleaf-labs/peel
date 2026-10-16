import { describe, expect, test } from 'bun:test'

import { generateText } from 'ai'

import { AI_PROVIDERS } from '@open-pencil/core/constants'

import { DIRECT_PROVIDER_IDS, modelProviderAdapter } from '@/app/ai/providers/registry'

import { fetchStub } from '#tests/helpers/fetch'

describe('model providers', () => {
  test('offers the Anthropic API as the only provider, with no coding agent or harness', () => {
    expect(DIRECT_PROVIDER_IDS).toEqual(['anthropic'])
    expect(AI_PROVIDERS.map((provider) => provider.id)).toEqual(['anthropic'])
  })

  test('sends model requests to api.anthropic.com only', async () => {
    const hosts: string[] = []
    const fetch = fetchStub(async (input) => {
      hosts.push(new URL(input instanceof Request ? input.url : String(input)).host)
      return new Response(JSON.stringify({ error: { message: 'stub' } }), { status: 401 })
    })
    const model = modelProviderAdapter('anthropic').create(
      {
        providerID: 'anthropic',
        apiKey: 'sk-ant-test',
        modelID: 'claude-sonnet-5-5',
        customModelID: ''
      },
      { fetch }
    )

    await generateText({ model, prompt: 'Reply with OK.', maxRetries: 0 }).catch(() => undefined)

    expect(hosts.length).toBeGreaterThan(0)
    expect(new Set(hosts)).toEqual(new Set(['api.anthropic.com']))
  })
})
