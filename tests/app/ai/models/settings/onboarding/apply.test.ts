import { describe, expect, test } from 'bun:test'

import { parseAIModelSettings, type AIModelSettings } from '@/app/ai/models'
import {
  applyOnboardingPlan,
  isUnconfiguredModelSettings
} from '@/app/ai/models/settings/onboarding/apply'
import { currentOnboardingModels } from '@/app/ai/models/settings/onboarding/current'
import { planOnboarding, type OnboardingAnswers } from '@/app/ai/models/settings/onboarding/plan'

import { defaultModel, isFastToolModel } from '#tests/helpers/ai/model-catalog'

function freshInstall(): AIModelSettings {
  return {
    version: 1,
    connections: [
      { id: 'connection-default', providerID: 'anthropic', credentialProfileId: 'default' }
    ],
    models: [
      {
        id: 'model-default',
        name: 'Design model',
        connectionId: 'connection-default',
        modelID: '',
        customModelID: '',
        maxOutputTokens: 16_384,
        thinkingLevel: 'default',
        capabilities: ['tools']
      }
    ],
    assignments: { design: 'model-default', review: 'design', fast: 'design', vision: null }
  }
}

function configured(): AIModelSettings {
  return {
    version: 1,
    connections: [
      {
        id: 'connection-anthropic',
        providerID: 'anthropic',
        credentialProfileId: 'connection-anthropic'
      }
    ],
    models: [
      {
        id: 'model-opus',
        name: 'Claude Opus 5',
        connectionId: 'connection-anthropic',
        modelID: 'claude-opus-5',
        customModelID: '',
        maxOutputTokens: 32_000,
        thinkingLevel: 'high',
        capabilities: ['tools', 'vision']
      }
    ],
    assignments: { design: 'model-opus', review: 'model-opus', fast: null, vision: 'design' }
  }
}

function sequentialIds() {
  let next = 0
  return () => `id-${++next}`
}

function apply(settings: AIModelSettings, answers: OnboardingAnswers) {
  return applyOnboardingPlan({
    settings,
    plan: planOnboarding(answers, { current: currentOnboardingModels(settings) }),
    createId: sequentialIds()
  })
}

describe('applyOnboardingPlan', () => {
  test('replaces the empty fresh-install profile with the planned models', () => {
    const { settings, connectionIds } = apply(freshInstall(), {
      goals: ['design', 'vision'],
      access: ['anthropic']
    })
    expect(settings.models).toEqual([
      expect.objectContaining({
        id: 'model-id-1',
        connectionId: 'connection-default',
        modelID: defaultModel('anthropic'),
        capabilities: ['tools', 'vision']
      }),
      expect.objectContaining({ id: 'model-id-2', connectionId: 'connection-default' })
    ])
    expect(isFastToolModel('anthropic', settings.models[1]?.modelID ?? '')).toBe(true)
    expect(settings.connections.map((connection) => connection.id)).toEqual(['connection-default'])
    expect(settings.assignments).toEqual({
      design: 'model-id-1',
      review: 'design',
      fast: 'model-id-2',
      vision: 'design'
    })
    expect(connectionIds).toEqual({ anthropic: 'connection-default' })
  })

  test('produces settings the store accepts unchanged', () => {
    const { settings } = apply(freshInstall(), {
      goals: ['design', 'vision'],
      access: ['anthropic']
    })
    expect(parseAIModelSettings(settings)).toEqual(settings)
  })

  test('reuses a matching connection and profile and keeps advanced settings', () => {
    const before = configured()
    before.models.push({
      id: 'model-sonnet',
      name: 'Claude Sonnet 5',
      connectionId: 'connection-anthropic',
      modelID: 'claude-sonnet-5',
      customModelID: '',
      maxOutputTokens: 64_000,
      thinkingLevel: 'low',
      capabilities: ['tools', 'vision']
    })
    before.assignments = { design: 'model-sonnet', review: 'model-opus', fast: null, vision: null }
    const { settings, connectionIds } = apply(before, { goals: ['design'], access: ['anthropic'] })
    expect(settings.connections).toEqual(before.connections)
    expect(settings.models).toEqual(before.models)
    // Review and fast work are never asked about, so an explicit none stays none.
    expect(settings.assignments).toEqual(before.assignments)
    expect(connectionIds).toEqual({})

    const again = apply(settings, { goals: ['design'], access: ['anthropic'] })
    expect(again.settings).toEqual(settings)
  })

  test('reuses a catalog profile it would otherwise create', () => {
    const before = freshInstall()
    before.models.push({
      id: 'model-sonnet',
      name: 'Sonnet',
      connectionId: 'connection-default',
      modelID: defaultModel('anthropic'),
      customModelID: '',
      maxOutputTokens: 64_000,
      thinkingLevel: 'low',
      capabilities: ['tools', 'vision']
    })
    const { settings, connectionIds } = apply(before, { goals: ['design'], access: ['anthropic'] })
    expect(settings.assignments.design).toBe('model-sonnet')
    expect(settings.models.find((profile) => profile.id === 'model-sonnet')).toMatchObject({
      maxOutputTokens: 64_000,
      thinkingLevel: 'low'
    })
    expect(connectionIds).toEqual({ anthropic: 'connection-default' })
  })

  test('keeps a working vision route for roles that were not asked about', () => {
    const before = configured()
    const { settings } = apply(before, { goals: ['vision'], access: ['anthropic'] })
    expect(settings.assignments).toEqual(before.assignments)
    expect(settings.models).toEqual(before.models)
  })
})

describe('isUnconfiguredModelSettings', () => {
  test('recognizes only the empty fresh-install settings', () => {
    expect(isUnconfiguredModelSettings(freshInstall())).toBe(true)
    expect(isUnconfiguredModelSettings(configured())).toBe(false)
    const named = freshInstall()
    named.models[0].customModelID = 'claude-sonnet-5'
    expect(isUnconfiguredModelSettings(named)).toBe(false)
  })
})

describe('applyOnboardingPlan with configured models', () => {
  test('keeps a configured profile with its own settings', () => {
    const before = configured()
    const { settings } = apply(before, { goals: ['design'], access: ['anthropic'] })
    expect(settings).toEqual(before)
  })

  test('does not give the vision role to a matching profile without image input', () => {
    const before = configured()
    before.models.push({
      id: 'model-sonnet-text',
      name: 'Sonnet text',
      connectionId: 'connection-anthropic',
      modelID: defaultModel('anthropic'),
      customModelID: '',
      maxOutputTokens: 16_384,
      thinkingLevel: 'default',
      capabilities: ['tools']
    })
    // Opus cannot review images here, so vision needs a new image-capable profile.
    before.models[0].capabilities = ['tools']
    before.assignments.vision = null
    const { settings } = apply(before, { goals: ['vision'], access: ['anthropic'] })
    const vision = settings.models.find((profile) => profile.id === settings.assignments.vision)
    expect(vision?.id).not.toBe('model-sonnet-text')
    expect(vision?.capabilities).toContain('vision')
  })

  test('clears an explicit vision assignment to a profile without image input', () => {
    const before = configured()
    before.models[0].capabilities = ['tools']
    before.assignments.vision = 'model-opus'
    const { settings } = apply(before, { goals: ['design'], access: [] })
    expect(settings.assignments.vision).toBeNull()
  })
})
