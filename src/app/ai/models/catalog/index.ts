import type { AIProviderID, ModelOption } from '@open-pencil/core/constants'

/**
 * The Claude models Peel offers, checked in so that listing them never contacts a catalog
 * service. Update this list when Anthropic releases or retires a model.
 */
export const ANTHROPIC_MODELS: readonly ModelOption[] = [
  {
    id: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5',
    tag: 'Best for design',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 128_000
  },
  {
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    tag: 'Deep reasoning',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 128_000
  },
  {
    id: 'claude-fable-5-1',
    name: 'Claude Fable 5.1',
    tag: 'Most capable',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 128_000
  },
  {
    id: 'claude-haiku-5-5',
    name: 'Claude Haiku 5.5',
    tag: 'Fast',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 128_000
  },
  {
    id: 'claude-fable-5',
    name: 'Claude Fable 5',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 128_000
  },
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 128_000
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 128_000
  },
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 128_000
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 128_000
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    capabilities: ['tools', 'vision'],
    recommendedMaxOutputTokens: 64_000
  }
]

/** The checked-in models of a provider; agents choose their own model and list none. */
export function catalogModels(providerID: AIProviderID): readonly ModelOption[] {
  return providerID === 'anthropic' ? ANTHROPIC_MODELS : []
}

/** The checked-in entry for a model ID, or `null` for an ID the list does not know. */
export function catalogModel(providerID: AIProviderID, modelID: string): ModelOption | null {
  return catalogModels(providerID).find((model) => model.id === modelID) ?? null
}
