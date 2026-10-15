import { createAnthropic } from '@ai-sdk/anthropic'

import { IS_TAURI, type AIProviderID } from '@open-pencil/core/constants'

import type { ModelProviderAdapter } from '@/app/ai/providers/types'

// Anthropic omits CORS headers unless the caller opts in, so browser requests fail with an
// opaque "failed to fetch". The desktop build goes through tauriFetch and is not subject to CORS.
const BROWSER_ACCESS_HEADERS = { 'anthropic-dangerous-direct-browser-access': 'true' }

/**
 * The Anthropic API at its default address. Peel offers no custom base URL, so requests go only
 * to the host the AI SDK provider is built for.
 */
const anthropicAdapter: ModelProviderAdapter = {
  create(config, runtime) {
    const provider = createAnthropic({
      apiKey: config.apiKey,
      fetch: runtime.fetch,
      headers: IS_TAURI ? undefined : BROWSER_ACCESS_HEADERS
    })
    return provider(config.modelID)
  }
}

/** The API providers a model connection can use, which is Anthropic alone. */
export const DIRECT_PROVIDER_IDS = ['anthropic'] as const satisfies readonly AIProviderID[]

export type DirectProviderID = (typeof DIRECT_PROVIDER_IDS)[number]

const MODEL_PROVIDER_ADAPTERS = {
  anthropic: anthropicAdapter
} satisfies Record<DirectProviderID, ModelProviderAdapter>

export function isDirectProviderID(providerID: AIProviderID): providerID is DirectProviderID {
  return DIRECT_PROVIDER_IDS.some((candidate) => candidate === providerID)
}

export function modelProviderAdapter(providerID: AIProviderID): ModelProviderAdapter {
  if (!isDirectProviderID(providerID)) {
    throw new Error('ACP providers and Harness agents do not use direct API models')
  }
  return MODEL_PROVIDER_ADAPTERS[providerID]
}
