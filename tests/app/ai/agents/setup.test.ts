import { describe, expect, mock, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import { createAgentDiscovery } from '@/app/ai/agents/discovery'
import type { AgentLookup } from '@/app/ai/agents/native'
import {
  mcpServerSetupView,
  useMCPServerSetup,
  type MCPServerSetupState
} from '@/app/ai/agents/setup'
import { MCP_INSTALL_COMMAND } from '@/app/automation/mcp/failure'

function lookup(...commands: string[]): AgentLookup {
  return {
    searchPath: '/test/bin',
    versions: {},
    executables: Object.fromEntries(commands.map((command) => [command, `/test/bin/${command}`]))
  }
}

function mcpServerState(overrides: Partial<MCPServerSetupState> = {}): MCPServerSetupState {
  return {
    supported: true,
    checked: true,
    bridge: false,
    bridgeOutdated: false,
    bridgeCommand: 'bun add -g @open-pencil/mcp@0.0.0-test',
    npm: true,
    installingBridge: false,
    error: null,
    ...overrides
  }
}

describe('mcpServerSetupView', () => {
  test('installs or updates the MCP server with one click when npm is available', () => {
    const missing = mcpServerSetupView(mcpServerState())
    expect(missing.bridge.action).toBe('install')
    expect(missing.manualCommand).toBeNull()
    expect(missing.problem).toBeNull()
    const outdated = mcpServerState({ bridge: true, bridgeOutdated: true })
    expect(mcpServerSetupView(outdated).bridge.action).toBe('update')
  })

  test('falls back to the command by hand without npm, after a check', () => {
    expect(mcpServerSetupView(mcpServerState({ npm: false, checked: false })).manualCommand).toBe(
      null
    )
    const view = mcpServerSetupView(mcpServerState({ npm: false }))
    expect(view.bridge.action).toBeNull()
    expect(view.problem).toBe('needs-npm')
    expect(view.manualCommand).toBe('bun add -g @open-pencil/mcp@0.0.0-test')
  })

  test('keeps the retry and adds the command by hand after a failed installation', () => {
    const view = mcpServerSetupView(mcpServerState({ error: 'canvas-install' }))
    expect(view.bridge.action).toBe('install')
    expect(view.problem).toBe('install-failed')
    expect(view.manualCommand).not.toBeNull()
  })

  test('offers the update one click can make with Bun, even without npm', () => {
    const view = mcpServerSetupView(
      mcpServerState({ bridge: true, bridgeOutdated: true, npm: false, bridgeInstallable: true })
    )
    expect(view.bridge.action).toBe('update')
    expect(view.problem).toBeNull()
    expect(view.manualCommand).toBeNull()
  })

  test('asks for administrator rights instead of a one-click install npm cannot finish', () => {
    const view = mcpServerSetupView(
      mcpServerState({ bridgeNeedsAdmin: true, bridgeCommand: 'sudo npm i -g x' })
    )
    expect(view.bridge.action).toBeNull()
    expect(view.problem).toBe('needs-admin')
    expect(view.manualCommand).toBe('sudo npm i -g x')
  })

  test('gives only the command where the app cannot install', () => {
    const view = mcpServerSetupView(mcpServerState({ supported: false }))
    expect(view.bridge.action).toBeNull()
    expect(view.manualCommand).toBe(MCP_INSTALL_COMMAND)
    // Nothing to install with, so no npm problem to report.
    expect(view.problem).toBeNull()
  })
})

describe('useMCPServerSetup', () => {
  test('checks while active, then installs and restarts the server with one click', async () => {
    let installed = false
    const installBridge = mock(async () => {
      installed = true
    })
    const restartBridge = mock(async () => undefined)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async (): Promise<AgentLookup> => ({
        ...lookup('npm', ...(installed ? ['openpencil-mcp-http'] : [])),
        versions: installed ? { '@open-pencil/mcp': '0.0.0-test' } : {}
      }),
      installBridge,
      restartBridge
    })
    const active = ref(false)
    const server = useMCPServerSetup(active, discovery)
    expect(server.state.value.checked).toBe(false)

    active.value = true
    await nextTick()
    await discovery.refresh()
    expect(mcpServerSetupView(server.state.value).bridge.action).toBe('install')

    await server.install()
    expect(installBridge).toHaveBeenCalledTimes(1)
    expect(restartBridge).toHaveBeenCalledTimes(1)
    expect(mcpServerSetupView(server.state.value).bridge.ready).toBe(true)
  })
})
