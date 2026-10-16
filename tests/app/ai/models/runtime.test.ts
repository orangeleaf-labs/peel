import { afterEach, describe, expect, test } from 'bun:test'

import {
  aiModelSettings,
  modelSettingsSnapshot,
  replaceAIModelSettings,
  setModelConnectionAPIKey
} from '@/app/ai/models'
import { appCredentialStore, initialCredentialStore } from '@/app/settings/credentials/app'
import { MemoryCredentialStore } from '@/app/settings/credentials/memory'
import { NativeCredentialStore } from '@/app/settings/credentials/native'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

const original = modelSettingsSnapshot()

afterEach(async () => {
  await appCredentialStore.switchTo(new MemoryCredentialStore(), [])
  await clearTauriMocks()
  replaceAIModelSettings(original)
})

describe('Anthropic API key storage', () => {
  test('the desktop app keeps secrets in the system credential store', () => {
    for (const remembered of [true, false]) {
      expect(initialCredentialStore({ desktop: true, remembered }).backend).toBe('native')
    }
  })

  test('saving a key writes it to the system credential store', async () => {
    const calls: { cmd: string; args: unknown }[] = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      return null
    })
    await appCredentialStore.switchTo(new NativeCredentialStore(), [])
    replaceAIModelSettings({
      version: 1,
      connections: [
        { id: 'connection-anthropic', providerID: 'anthropic', credentialProfileId: 'work' }
      ],
      models: [
        {
          id: 'model-design',
          name: 'Claude',
          connectionId: 'connection-anthropic',
          modelID: 'claude-sonnet-5-5',
          customModelID: '',
          maxOutputTokens: 16_384,
          thinkingLevel: 'default',
          capabilities: ['tools', 'vision']
        }
      ],
      assignments: { design: 'model-design', review: 'design', fast: 'design', vision: 'design' }
    })
    expect(aiModelSettings.value.connections).toHaveLength(1)

    await setModelConnectionAPIKey('connection-anthropic', '  sk-ant-test  ')

    expect(calls).toEqual([
      {
        cmd: 'credential_write',
        args: {
          reference: { integrationId: 'anthropic', profileId: 'work', field: 'api-key' },
          value: 'sk-ant-test'
        }
      }
    ])
  })
})
