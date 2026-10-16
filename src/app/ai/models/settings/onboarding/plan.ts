import { uniq } from 'es-toolkit'

import type { AIProviderID, ModelOption } from '@open-pencil/core/constants'

import { catalogModels } from '@/app/ai/models/catalog'
import { modelProviderName, providerDefinition } from '@/app/ai/models/provider-name'
import type { AIModelCapability, AIModelProfileId, AIModelRole } from '@/app/ai/models/types'

/** Roles onboarding asks about; review and fast stay in the advanced settings. */
export const ONBOARDING_GOALS = ['design', 'vision'] as const
export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number]

/** The API account onboarding connects; Peel talks to the Anthropic API only. */
export const ONBOARDING_API_PROVIDERS = ['anthropic'] as const

export type OnboardingAccess = (typeof ONBOARDING_API_PROVIDERS)[number]

const ONBOARDING_ACCESS = new Set<string>(ONBOARDING_API_PROVIDERS)

export function isOnboardingAccess(providerID: string): providerID is OnboardingAccess {
  return ONBOARDING_ACCESS.has(providerID)
}

export interface OnboardingAnswers {
  goals: OnboardingGoal[]
  access: OnboardingAccess[]
}

export interface PlannedModel {
  providerID: AIProviderID
  /** Catalog model ID; empty when the catalog has no default model for the provider. */
  modelID: string
  name: string
  capabilities: AIModelCapability[]
  /** Set when the plan keeps a model that is already configured. */
  profileId?: AIModelProfileId
}

/** A model for a role, the design model (`'design'`), or nothing. */
export type PlannedRole = PlannedModel | 'design' | null

export interface OnboardingPlan {
  /** `null` keeps the design model that is configured now. */
  design: PlannedModel | null
  vision: PlannedRole
  review: PlannedRole
  fast: PlannedRole
  /** Providers to connect before the plan can be applied, in the order they are used. */
  connections: OnboardingAccess[]
}

/** The models currently assigned to each role. */
export interface CurrentOnboardingModels {
  /** False for a fresh install, whose empty roles are not choices to keep. */
  configured: boolean
  design: PlannedModel | null
  vision: PlannedRole
  review: PlannedRole
  fast: PlannedRole
}

export interface PlanOptions {
  current?: CurrentOnboardingModels
}

const NO_CURRENT: CurrentOnboardingModels = {
  configured: false,
  design: null,
  vision: null,
  review: null,
  fast: null
}

function fromCatalog(providerID: AIProviderID, model: ModelOption): PlannedModel {
  return {
    providerID,
    modelID: model.id,
    name: model.name,
    capabilities: model.capabilities ? [...model.capabilities] : ['tools']
  }
}

function plannedModel(providerID: OnboardingAccess): PlannedModel {
  const defaultID = providerDefinition(providerID)?.defaultModel
  const model = catalogModels(providerID).find((candidate) => candidate.id === defaultID)
  return model
    ? fromCatalog(providerID, model)
    : { providerID, modelID: '', name: modelProviderName(providerID), capabilities: ['tools'] }
}

/** The provider's model tagged as fast, for low-cost background work. */
function fastModel(providerID: AIProviderID): PlannedModel | null {
  const model = catalogModels(providerID).find(
    (candidate) => candidate.tag === 'Fast' && candidate.capabilities?.includes('tools')
  )
  return model ? fromCatalog(providerID, model) : null
}

function hasVision(model: PlannedModel): boolean {
  return model.capabilities.includes('vision')
}

/**
 * A configured model stays while its access is still selected or onboarding cannot offer it.
 * An API profile that names no model, such as the fresh-install placeholder, is never kept.
 */
function keepable(model: PlannedModel | null, access: OnboardingAccess[]): model is PlannedModel {
  if (!model) return false
  if (!model.modelID) return false
  return !isOnboardingAccess(model.providerID) || access.includes(model.providerID)
}

/** Whether a role may follow the design model; vision needs image input. */
export function canFollowDesign(role: AIModelRole, design: PlannedModel | null): boolean {
  if (!design) return false
  return role !== 'vision' || hasVision(design)
}

function planDesign(access: OnboardingAccess[], current: PlannedModel | null) {
  if (keepable(current, access)) return current
  const existing = ONBOARDING_API_PROVIDERS.find((providerID) => access.includes(providerID))
  return existing ? plannedModel(existing) : null
}

function planVision(
  design: PlannedModel | null,
  access: OnboardingAccess[],
  current: PlannedRole
): PlannedRole {
  if (current !== null && current !== 'design' && keepable(current, access)) return current
  if (canFollowDesign('vision', design)) return 'design'
  const existing = ONBOARDING_API_PROVIDERS.filter((providerID) => access.includes(providerID))
    .map((providerID) => plannedModel(providerID))
    .find(hasVision)
  if (existing) return existing
  // Nothing new covers visual review, so a configured vision model stays as it is; inheriting
  // from a design model that cannot accept images is not possible.
  return current === 'design' ? null : current
}

/**
 * Review and fast work are never asked about, so a configured choice stays, including none,
 * unless it follows a design model it can no longer follow.
 */
function keepRole(
  current: CurrentOnboardingModels,
  role: 'review' | 'fast',
  design: PlannedModel | null
) {
  const choice = current[role]
  if (!current.configured) return false
  return choice !== 'design' || canFollowDesign(role, design)
}

/** Review follows the design model, or uses the model chosen for vision without one. */
function planReview(
  design: PlannedModel | null,
  vision: PlannedRole,
  current: CurrentOnboardingModels
): PlannedRole {
  if (keepRole(current, 'review', design)) return current.review
  if (canFollowDesign('review', design)) return 'design'
  return vision !== 'design' && vision?.capabilities.includes('tools') ? vision : null
}

/** Fast work uses the provider's fast model when it has one, otherwise the design model. */
function planFast(
  design: PlannedModel | null,
  vision: PlannedRole,
  current: CurrentOnboardingModels
): PlannedRole {
  if (keepRole(current, 'fast', design)) return current.fast
  const apiVision = vision === 'design' ? null : vision
  const base = canFollowDesign('fast', design) ? design : apiVision
  const fast = base ? fastModel(base.providerID) : null
  if (fast && fast.modelID !== base?.modelID) return fast
  if (canFollowDesign('fast', design)) return 'design'
  return base
}

function roleModels(plan: Omit<OnboardingPlan, 'connections'>): PlannedModel[] {
  return [plan.design, plan.vision, plan.review, plan.fast].filter(
    (model): model is PlannedModel => model !== null && model !== 'design'
  )
}

/**
 * Proposes a model for each role, preferring what is already configured and then access the
 * person already has. Roles the person did not ask about keep their configuration.
 */
export function planOnboarding(answers: OnboardingAnswers, options: PlanOptions): OnboardingPlan {
  const access = answers.access
  const current = options.current ?? NO_CURRENT
  const design = answers.goals.includes('design')
    ? planDesign(access, current.design)
    : current.design
  const vision = answers.goals.includes('vision')
    ? planVision(design, access, current.vision)
    : current.vision
  const roles = {
    design,
    vision,
    review: planReview(design, vision, current),
    fast: planFast(design, vision, current)
  }
  return { ...roles, connections: planConnections(roles) }
}

/** Providers the planned models need connected, skipping models that are already configured. */
export function planConnections(roles: Omit<OnboardingPlan, 'connections'>): OnboardingAccess[] {
  const providers = roleModels(roles)
    .filter((model) => !model.profileId)
    .map((model) => model.providerID)
    .filter(isOnboardingAccess)
  return uniq(providers)
}

/** Whether every role the person asked about has a model. */
export function coversGoals(plan: OnboardingPlan, goals: OnboardingGoal[]): boolean {
  return goals.every((goal) => plan[goal] !== null)
}

/** Requested goals that the access the person selected cannot cover. */
export function uncoveredGoals(answers: OnboardingAnswers, options: PlanOptions): OnboardingGoal[] {
  const plan = planOnboarding(answers, options)
  return answers.goals.filter((goal) => plan[goal] === null)
}

export const SAME_AS_DESIGN = '__design__'
export const NO_MODEL = '__none__'

/** A stable key for a role choice, used as the value of the role's picker. */
export function roleChoiceKey(choice: PlannedRole): string {
  if (choice === 'design') return SAME_AS_DESIGN
  if (choice === null) return NO_MODEL
  return choice.profileId ?? `${choice.providerID}::${choice.modelID}`
}

/**
 * Choices for a role: configured models, every suitable catalog model of a connected provider,
 * and for the other roles the design model or nothing.
 */
export function roleOptions(
  role: AIModelRole,
  plan: OnboardingPlan,
  configured: PlannedModel[]
): PlannedRole[] {
  const needs: AIModelCapability = role === 'vision' ? 'vision' : 'tools'
  // Planned models come first so a provider whose catalog lists no capabilities still offers one.
  const candidates: PlannedModel[] = [...configured, ...roleModels(plan)]
  for (const providerID of plan.connections) {
    candidates.push(
      ...catalogModels(providerID)
        .filter((model) => model.capabilities)
        .map((model) => fromCatalog(providerID, model))
    )
  }
  const suitable = candidates.filter((model) => model.capabilities.includes(needs))
  const unique = new Map(suitable.map((model) => [roleChoiceKey(model), model]))
  const models = [...unique.values()]
  if (role === 'design') return models
  return [...(canFollowDesign(role, plan.design) ? (['design'] as const) : []), null, ...models]
}
