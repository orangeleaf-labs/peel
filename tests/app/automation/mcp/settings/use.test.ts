import { afterEach, describe, expect, test } from 'bun:test'

import { mcpRootDirectory } from '@/app/automation/mcp/preferences'
import { chooseMCPRootDirectory } from '@/app/automation/mcp/settings/use'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  mcpRootDirectory.value = ''
  await clearTauriMocks()
})

async function chooseWith(picked: string | null): Promise<string[]> {
  const calls: string[] = []
  await mockTauriIPC((cmd) => {
    calls.push(cmd)
    return cmd === 'pick_mcp_root_folder' ? picked : null
  })
  await chooseMCPRootDirectory()
  return calls
}

describe('MCP root folder picker', () => {
  test('picks the folder natively, never through the scope-granting dialog command', async () => {
    const calls = await chooseWith('/Users/someone')

    expect(mcpRootDirectory.value).toBe('/Users/someone')
    expect(calls).toContain('pick_mcp_root_folder')
    expect(calls.filter((cmd) => cmd.startsWith('plugin:dialog|'))).toEqual([])
  })

  test('keeps the previous folder when the user cancels', async () => {
    mcpRootDirectory.value = '/Users/someone/designs'

    await chooseWith(null)

    expect(mcpRootDirectory.value).toBe('/Users/someone/designs')
  })
})
