import { describe, expect, test } from 'bun:test'

import {
  uncoveredGoals,
  planOnboarding,
  roleChoiceKey,
  roleOptions,
  type OnboardingAnswers,
  type OnboardingPlan
} from '@/app/ai/models/settings/onboarding/plan'

import { defaultModel, isFastToolModel } from '#tests/helpers/ai/model-catalog'

const desktop = {}

function answers(overrides: Partial<OnboardingAnswers>): OnboardingAnswers {
  return { goals: ['design'], access: [], ...overrides }
}

function plannedModelID(choice: OnboardingPlan['fast']): string {
  return typeof choice === 'object' && choice !== null ? choice.modelID : ''
}

describe('planOnboarding', () => {
  test('reuses a vision-capable design model for visual review', () => {
    const plan = planOnboarding(
      answers({ goals: ['design', 'vision'], access: ['anthropic'] }),
      desktop
    )
    expect(plan.design).toMatchObject({
      providerID: 'anthropic',
      modelID: defaultModel('anthropic')
    })
    expect(plan.vision).toBe('design')
    expect(plan.connections).toEqual(['anthropic'])
  })

  test('proposes nothing when no access is selected', () => {
    const plan = planOnboarding(answers({ goals: ['design', 'vision'] }), desktop)
    expect(plan).toEqual({ design: null, vision: null, review: null, fast: null, connections: [] })
  })

  test('plans only the roles that were asked for', () => {
    const plan = planOnboarding(answers({ goals: ['vision'], access: ['anthropic'] }), desktop)
    expect(plan.design).toBeNull()
    expect(plan.vision).toMatchObject({ providerID: 'anthropic' })
  })
})

describe('planOnboarding with configured models', () => {
  const opus = {
    providerID: 'anthropic' as const,
    modelID: 'claude-opus-5',
    name: 'Claude Opus 5',
    capabilities: ['tools' as const, 'vision' as const],
    profileId: 'model-opus' as const
  }

  test('keeps a configured design model while its access is still selected', () => {
    const plan = planOnboarding(answers({ access: ['anthropic'] }), {
      ...desktop,
      current: { configured: true, design: opus, vision: null, review: null, fast: null }
    })
    expect(plan.design).toBe(opus)
    expect(plan.connections).toEqual([])
  })

  test('drops a configured design model whose access was deselected', () => {
    const plan = planOnboarding(answers({ access: [] }), {
      ...desktop,
      current: { configured: true, design: opus, vision: null, review: null, fast: null }
    })
    expect(plan.design).toBeNull()
  })

  test('keeps a configured vision model when nothing new covers visual review', () => {
    const plan = planOnboarding(answers({ goals: ['design', 'vision'], access: [] }), {
      ...desktop,
      current: {
        configured: true,
        design: null,
        vision: { ...opus, profileId: 'model-opus' },
        review: null,
        fast: null
      }
    })
    expect(plan.design).toBeNull()
    expect(plan.vision).toMatchObject({ profileId: 'model-opus' })
  })
})

describe('planOnboarding for review and fast work', () => {
  test('gives fast work the Anthropic model tagged as fast', () => {
    const plan = planOnboarding(answers({ access: ['anthropic'] }), desktop)
    expect(plan.review).toBe('design')
    expect(plan.fast).toMatchObject({ providerID: 'anthropic' })
    expect(isFastToolModel('anthropic', plannedModelID(plan.fast))).toBe(true)
  })

  test('keeps configured review and fast choices, including none', () => {
    const plan = planOnboarding(answers({ access: ['anthropic'] }), {
      ...desktop,
      current: { configured: true, design: null, vision: null, review: null, fast: 'design' }
    })
    expect(plan.review).toBeNull()
    expect(plan.fast).toBe('design')
  })
})

describe('roleOptions', () => {
  const plan = planOnboarding(
    answers({ goals: ['design', 'vision'], access: ['anthropic'] }),
    desktop
  )

  test('offers only built-in Anthropic models, never a coding agent', () => {
    for (const role of ['design', 'vision', 'review', 'fast'] as const) {
      for (const option of roleOptions(role, plan, [])) {
        if (option && option !== 'design') expect(option.providerID).toBe('anthropic')
      }
    }
    expect(roleOptions('design', plan, []).map(roleChoiceKey).join(' ')).not.toMatch(
      /acp:|harness:/
    )
  })

  test('offers only image-capable models for vision', () => {
    const vision = roleOptions('vision', plan, [])
    expect(vision).toContain(null)
    for (const option of vision) {
      if (option && option !== 'design') expect(option.capabilities).toContain('vision')
    }
  })

  test('offers same as design when the design model can take the role', () => {
    const api = planOnboarding(answers({ access: ['anthropic'] }), desktop)
    expect(roleOptions('fast', api, []).slice(0, 2)).toEqual(['design', null])
  })
})

describe('uncoveredGoals', () => {
  test('lists requested goals the selected access cannot cover', () => {
    expect(uncoveredGoals(answers({ goals: ['design'] }), desktop)).toEqual(['design'])
  })
})
