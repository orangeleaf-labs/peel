import { afterEach, describe, expect, test } from 'bun:test'

import {
  SETTINGS_SECTIONS,
  openSettingsDialog,
  settingsDialogOpen,
  settingsDialogSection
} from '@/app/settings/dialog'

afterEach(() => {
  settingsDialogOpen.value = false
  settingsDialogSection.value = 'general'
})

describe('Settings sections', () => {
  test('offer no Privacy section, since the app sends no pings or usage stats', () => {
    expect(SETTINGS_SECTIONS).not.toContain('privacy')
    expect(SETTINGS_SECTIONS).toEqual([
      'general',
      'toolbar',
      'ai',
      'usage',
      'diagnostics',
      'mcp',
      'tools',
      'media',
      'storage'
    ])
  })

  test('opens on the section it is asked for', () => {
    openSettingsDialog('diagnostics')
    expect(settingsDialogOpen.value).toBe(true)
    expect(settingsDialogSection.value).toBe('diagnostics')
  })
})
