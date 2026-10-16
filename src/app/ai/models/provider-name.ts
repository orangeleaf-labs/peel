import { AI_PROVIDERS, type AIProviderDef } from '@open-pencil/core/constants'

/**
 * The definition of a provider, or `undefined` for one Peel does not offer, such as a provider
 * read from settings saved by an older version.
 */
export function providerDefinition(providerID: string): AIProviderDef | undefined {
  return AI_PROVIDERS.find((provider) => provider.id === providerID)
}

/** Display name for a provider. */
export function modelProviderName(providerID: string): string {
  return providerDefinition(providerID)?.name ?? providerID
}

/** Whether a saved connection or planned model belongs to `providerID`. */
export function belongsToProvider(owner: { providerID: string }, providerID: string): boolean {
  return owner.providerID === providerID
}
