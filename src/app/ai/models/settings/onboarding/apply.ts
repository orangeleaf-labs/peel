import { DEFAULT_AI_PROVIDER, type AIProviderID } from '@open-pencil/core/constants'

import { catalogModel } from '@/app/ai/models/catalog'
import { belongsToProvider } from '@/app/ai/models/provider-name'
import type {
  AIModelConnection,
  AIModelProfile,
  AIModelProfileId,
  AIModelSettings
} from '@/app/ai/models/types'

import {
  isOnboardingAccess,
  type OnboardingAccess,
  type OnboardingPlan,
  type PlannedModel
} from './plan'

const DEFAULT_MAX_OUTPUT_TOKENS = 16_384
/** The profile a fresh install starts with before anything is configured. */
const PLACEHOLDER_PROFILE_ID = 'model-default'

export interface ApplyOnboardingInput {
  settings: AIModelSettings
  /** The final model for every role; a `null` design keeps the current design model. */
  plan: OnboardingPlan
  createId: () => string
}

export interface ApplyOnboardingResult {
  settings: AIModelSettings
  /** Connection used for each planned provider, so the caller can store its API key. */
  connectionIds: Partial<Record<OnboardingAccess, string>>
}

function effectiveModelID(profile: Pick<AIModelProfile, 'modelID' | 'customModelID'>): string {
  return profile.customModelID || profile.modelID
}

function recommendedMaxOutputTokens(providerID: AIProviderID, modelID: string): number {
  return catalogModel(providerID, modelID)?.recommendedMaxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
}

function isPlaceholder(settings: AIModelSettings, profile: AIModelProfile): boolean {
  if (profile.id !== PLACEHOLDER_PROFILE_ID || effectiveModelID(profile)) return false
  const connection = settings.connections.find((candidate) => candidate.id === profile.connectionId)
  return connection?.providerID === DEFAULT_AI_PROVIDER
}

function isUnusedPlaceholder(settings: AIModelSettings, profile: AIModelProfile): boolean {
  return (
    isPlaceholder(settings, profile) && !Object.values(settings.assignments).includes(profile.id)
  )
}

/** True while the settings hold only the empty profile a fresh install starts with. */
export function isUnconfiguredModelSettings(settings: AIModelSettings): boolean {
  return settings.models.length === 1 && isPlaceholder(settings, settings.models[0])
}

function hasConnection(settings: AIModelSettings, profile: AIModelProfile): boolean {
  return settings.connections.some((candidate) => candidate.id === profile.connectionId)
}

/**
 * Clears assignments the model settings would reject: a profile needs its connection, and
 * vision needs a model that accepts images, whether assigned directly or through the design model.
 */
function enforceRoleRules(settings: AIModelSettings): void {
  const profileOf = (id: string | null) => settings.models.find((profile) => profile.id === id)
  const design = profileOf(settings.assignments.design)
  for (const role of ['review', 'fast', 'vision'] as const) {
    const assignment = settings.assignments[role]
    if (assignment === null) continue
    const profile = assignment === 'design' ? design : profileOf(assignment)
    if (!profile) continue
    if (
      !hasConnection(settings, profile) ||
      (role === 'vision' && !profile.capabilities.includes('vision'))
    ) {
      settings.assignments[role] = null
    }
  }
}

function removeUnusedPlaceholder(settings: AIModelSettings): void {
  const placeholder = settings.models.find((profile) => isUnusedPlaceholder(settings, profile))
  if (!placeholder) return
  settings.models = settings.models.filter((profile) => profile !== placeholder)
  if (!settings.models.some((profile) => profile.connectionId === placeholder.connectionId)) {
    settings.connections = settings.connections.filter(
      (connection) => connection.id !== placeholder.connectionId
    )
  }
}

/**
 * Merges a confirmed onboarding plan into the current settings. Matching connections and
 * profiles are reused, and anything configured in the advanced settings is kept.
 */
export function applyOnboardingPlan({
  settings: current,
  plan,
  createId
}: ApplyOnboardingInput): ApplyOnboardingResult {
  const settings = structuredClone(current)
  const connectionIds: ApplyOnboardingResult['connectionIds'] = {}

  function connectionFor(providerID: OnboardingAccess): AIModelConnection {
    const existing = settings.connections.find((connection) =>
      belongsToProvider(connection, providerID)
    )
    const connection = existing ?? {
      id: `connection-${createId()}`,
      providerID,
      credentialProfileId: ''
    }
    if (!existing) {
      connection.credentialProfileId = connection.id
      settings.connections.push(connection)
    }
    connectionIds[providerID] = connection.id
    return connection
  }

  function profileFor(model: PlannedModel): AIModelProfileId | null {
    if (model.profileId) {
      return settings.models.some((profile) => profile.id === model.profileId)
        ? model.profileId
        : null
    }
    if (!isOnboardingAccess(model.providerID)) return null
    const connection = connectionFor(model.providerID)
    const wanted = model.modelID
    // Reuse only a profile that can do everything the plan relies on.
    const existing = settings.models.find(
      (profile) =>
        profile.connectionId === connection.id &&
        effectiveModelID(profile) === wanted &&
        model.capabilities.every((capability) => profile.capabilities.includes(capability))
    )
    if (existing) return existing.id
    const profile: AIModelProfile = {
      id: `model-${createId()}`,
      name: model.name,
      connectionId: connection.id,
      modelID: model.modelID,
      customModelID: '',
      maxOutputTokens: recommendedMaxOutputTokens(model.providerID, model.modelID),
      thinkingLevel: 'default',
      capabilities: [...model.capabilities]
    }
    settings.models.push(profile)
    return profile.id
  }

  if (plan.design) {
    settings.assignments.design = profileFor(plan.design) ?? settings.assignments.design
  }
  for (const role of ['vision', 'review', 'fast'] as const) {
    const choice = plan[role]
    settings.assignments[role] =
      choice === null || choice === 'design' ? choice : profileFor(choice)
  }

  enforceRoleRules(settings)
  removeUnusedPlaceholder(settings)

  return { settings, connectionIds }
}
