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

const desktop = { agentsAvailable: true }
const browser = { agentsAvailable: false }

function answers(overrides: Partial<OnboardingAnswers>): OnboardingAnswers {
  return { goals: ['design'], access: [], ...overrides }
}

function plannedModelID(choice: OnboardingPlan['fast']): string {
  return typeof choice === 'object' && choice !== null ? choice.modelID : ''
}

describe('planOnboarding', () => {
  test('uses an agent the person already has for design', () => {
    const plan = planOnboarding(answers({ access: ['acp:codex'] }), desktop)
    expect(plan.design).toMatchObject({ providerID: 'acp:codex', modelID: '' })
    expect(plan.connections).toEqual(['acp:codex'])
  })

  test('runs design on Pi and takes the other roles from the Anthropic API', () => {
    const plan = planOnboarding(
      answers({ goals: ['design', 'vision'], access: ['harness:pi', 'anthropic'] }),
      desktop
    )
    expect(plan.design).toMatchObject({ providerID: 'harness:pi', modelID: '' })
    expect(plan.vision).toMatchObject({ providerID: 'anthropic' })
    expect(plan.review).not.toBe('design')
    expect(plan.connections).toEqual(['harness:pi', 'anthropic'])
  })

  test('ignores agents outside the desktop app', () => {
    const plan = planOnboarding(answers({ access: ['acp:claude-code', 'anthropic'] }), browser)
    expect(plan.design).toMatchObject({
      providerID: 'anthropic',
      modelID: defaultModel('anthropic')
    })
  })

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

  test('takes visual review from the Anthropic API when design runs on an agent', () => {
    const plan = planOnboarding(
      answers({ goals: ['design', 'vision'], access: ['acp:claude-code', 'anthropic'] }),
      desktop
    )
    expect(plan.design).toMatchObject({ providerID: 'acp:claude-code' })
    expect(plan.vision).toMatchObject({
      providerID: 'anthropic',
      modelID: defaultModel('anthropic')
    })
    expect(plan.connections).toEqual(['acp:claude-code', 'anthropic'])
  })

  test('leaves visual review unassigned without an API account', () => {
    const plan = planOnboarding(
      answers({ goals: ['design', 'vision'], access: ['acp:codex'] }),
      desktop
    )
    expect(plan.vision).toBeNull()
    expect(plan.connections).toEqual(['acp:codex'])
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

  test('replaces a configured design model whose access was deselected', () => {
    const plan = planOnboarding(answers({ access: ['acp:codex'] }), {
      ...desktop,
      current: { configured: true, design: opus, vision: null, review: null, fast: null }
    })
    expect(plan.design).toMatchObject({ providerID: 'acp:codex' })
    expect(plan.design?.profileId).toBeUndefined()
  })

  test('keeps a configured vision model when nothing new covers visual review', () => {
    const plan = planOnboarding(answers({ goals: ['design', 'vision'], access: ['acp:codex'] }), {
      ...desktop,
      current: {
        configured: true,
        design: null,
        vision: { ...opus, profileId: 'model-opus' },
        review: null,
        fast: null
      }
    })
    expect(plan.design).toMatchObject({ providerID: 'acp:codex' })
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

  test('uses the API vision model for review and fast work behind an agent', () => {
    const plan = planOnboarding(
      answers({ goals: ['design', 'vision'], access: ['acp:codex', 'anthropic'] }),
      desktop
    )
    expect(plan.vision).toMatchObject({
      providerID: 'anthropic',
      modelID: defaultModel('anthropic')
    })
    expect(plan.review).toMatchObject({
      providerID: 'anthropic',
      modelID: defaultModel('anthropic')
    })
    expect(plan.fast).toMatchObject({ providerID: 'anthropic' })
    expect(isFastToolModel('anthropic', plannedModelID(plan.fast))).toBe(true)
    expect(planOnboarding(answers({ access: ['acp:codex'] }), desktop)).toMatchObject({
      review: null,
      fast: null
    })
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
    answers({ goals: ['design', 'vision'], access: ['acp:claude-code', 'anthropic'] }),
    desktop
  )

  test('offers an agent only for the design role', () => {
    expect(roleOptions('design', plan, []).map(roleChoiceKey)).toContain('acp:claude-code::')
    expect(roleOptions('review', plan, []).map(roleChoiceKey)).not.toContain('acp:claude-code::')
  })

  test('offers only image-capable models for vision and none instead of an agent design', () => {
    const vision = roleOptions('vision', plan, [])
    expect(vision).toContain(null)
    expect(vision).not.toContain('design')
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
    expect(
      uncoveredGoals(answers({ goals: ['design', 'vision'], access: ['acp:codex'] }), desktop)
    ).toEqual(['vision'])
    expect(uncoveredGoals(answers({ goals: ['design'] }), desktop)).toEqual(['design'])
  })
})
