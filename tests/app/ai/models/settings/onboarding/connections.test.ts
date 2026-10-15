import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  type AIModelSettings
} from '@/app/ai/models'
import { existingOnboardingConnection } from '@/app/ai/models/settings/onboarding/connections'

let original: AIModelSettings

beforeEach(() => {
  original = modelSettingsSnapshot()
  replaceAIModelSettings({
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
        id: 'model-sonnet',
        name: 'Sonnet',
        connectionId: 'connection-anthropic',
        modelID: 'claude-sonnet-5',
        customModelID: '',
        maxOutputTokens: 16_384,
        thinkingLevel: 'default',
        capabilities: ['tools']
      }
    ],
    assignments: { design: 'model-sonnet', review: null, fast: null, vision: null }
  })
})

afterEach(() => replaceAIModelSettings(original))

describe('existingOnboardingConnection', () => {
  test('reuses the Anthropic connection that is already configured', () => {
    expect(existingOnboardingConnection('anthropic')?.id).toBe('connection-anthropic')
    expect(existingOnboardingConnection('acp:codex')).toBeNull()
  })
})
