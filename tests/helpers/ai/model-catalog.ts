import { AI_PROVIDERS, type AIProviderID } from '@open-pencil/core/constants'

import { catalogModel } from '@/app/ai/models/catalog'

/** The catalog's default model, so onboarding tests follow catalog updates. */
export function defaultModel(providerID: string): string {
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.defaultModel ?? ''
}

/** Whether the catalog offers `modelID` as a fast model that can call tools. */
export function isFastToolModel(providerID: AIProviderID, modelID: string): boolean {
  const model = catalogModel(providerID, modelID)
  return model?.tag === 'Fast' && model.capabilities?.includes('tools') === true
}
