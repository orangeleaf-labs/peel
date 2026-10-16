import { expect, test } from 'bun:test'

import { effectScope, reactive, ref } from 'vue'

import { createModelProfileDraft } from '@/app/ai/models'
import { ANTHROPIC_MODELS } from '@/app/ai/models/catalog'
import { useProfileModelSelection } from '@/app/ai/models/settings/profile-editor/selection'

import { fetchStub } from '#tests/helpers/fetch'

const labels = ref({
  recommendedModels: 'Recommended',
  latestModels: 'Latest',
  allModels: 'All',
  latest: 'New',
  customModelGroup: 'Custom model',
  customModel: 'Custom'
})

test('selection offers the checked-in models and applies their metadata without a request', () => {
  const originalFetch = globalThis.fetch
  const requests: string[] = []
  globalThis.fetch = fetchStub(async (input) => {
    requests.push(String(input))
    return new Response(null, { status: 500 })
  })
  const scope = effectScope()
  try {
    const draft = reactive(createModelProfileDraft())
    draft.providerID = 'anthropic'
    draft.name = ''
    const selection = scope.run(() => useProfileModelSelection(draft, labels))
    if (!selection) throw new Error('Missing selection scope')
    expect(selection.modelOptions.value.map((option) => option.value)).toEqual(
      ANTHROPIC_MODELS.map((model) => model.id)
    )

    const chosen = ANTHROPIC_MODELS[ANTHROPIC_MODELS.length - 1]
    selection.updateModel(chosen.id)
    expect(draft.modelID).toBe(chosen.id)
    expect(draft.capabilities).toEqual([...(chosen.capabilities ?? [])])
    expect(draft.maxOutputTokens).toBe(chosen.recommendedMaxOutputTokens ?? 16_384)
    expect(draft.name).toBe(chosen.name)
    expect(requests).toEqual([])
  } finally {
    scope.stop()
    globalThis.fetch = originalFetch
  }
})

test('a profile without a model starts on the provider recommended model', () => {
  const scope = effectScope()
  try {
    const draft = reactive(createModelProfileDraft())
    draft.providerID = 'anthropic'
    draft.modelID = ''
    draft.customModelID = ''
    draft.name = 'Design model'
    scope.run(() => useProfileModelSelection(draft, labels))
    expect(draft.modelID).toBe('claude-sonnet-5-5')
    expect(draft.capabilities).toEqual(['tools', 'vision'])
    expect(draft.name).toBe('Design model')
  } finally {
    scope.stop()
  }
})
